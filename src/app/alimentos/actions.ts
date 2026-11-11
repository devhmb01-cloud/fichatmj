"use server";
import { z } from "zod";
import { requireTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type FoodState, type FoodItem, type FoodDistributionLine, type FoodLot, type FoodLoss } from "@/lib/alimentos/model";

export type FoodActionResponse =
  | { ok: true; state: FoodState; duplicate: boolean }
  | { ok: false; message: string };
type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;
function ensureEnabled() {
  if (process.env.FOOD_PERSISTENCE_ENABLED !== "true")
    throw new Error("Integração de alimentos ainda não está ativada neste ambiente.");
}
async function readState(client: Client): Promise<FoodState> {
  ensureEnabled();
  const [items, families, deliveries, settings, lots, losses] = await Promise.all([
    client.from("food_items").select("id,name,unit,stock,per_basket").order("name"),
    // Only family identifier and internal code; do not copy health, address or contact data.
    client.from("families").select("id,family_code").order("family_code").limit(1000),
    client.from("food_distributions").select("id,family_id,lines,delivered_at")
      .order("delivered_at", { ascending: false }).limit(300),
    client.from("food_settings").select("monthly_families").eq("id", 1).single(),
    client.from("food_lots").select("id,item_id,remaining,expires_on,created_at,origin").order("created_at",{ascending:false}).limit(1000),
    client.from("food_losses").select("id,item_id,lot_id,quantity,reason,created_at").order("created_at",{ascending:false}).limit(1000),
  ]);
  if (items.error || families.error || deliveries.error || settings.error || !settings.data || lots.error || losses.error ||
    (lots.data?.length ?? 0) >= 1000 || (losses.data?.length ?? 0) >= 1000) {
    throw new Error("Não foi possível consultar os alimentos. Confira as migrações e permissões.");
  }
  return {
    items: (items.data ?? []).map((row): FoodItem => ({
      id: row.id, name: row.name, unit: row.unit,
      stock: row.stock, perBasket: row.per_basket,
    })),
    families: (families.data ?? []).map(row => ({ id: row.id, code: row.family_code })),
    distributions: (deliveries.data ?? []).map(row => ({
      id: row.id, familyId: row.family_id, deliveredAt: row.delivered_at,
      lines: Array.isArray(row.lines) ? (row.lines as FoodDistributionLine[]) : [],
    })),
    monthlyFamilies: settings.data.monthly_families,
    lots: (lots.data ?? []).map((row):FoodLot => ({id:row.id,itemId:row.item_id,remaining:row.remaining,
      expiresOn:row.expires_on,createdAt:row.created_at,origin:row.origin})),
    losses: (losses.data ?? []).map((row):FoodLoss => ({id:row.id,itemId:row.item_id,lotId:row.lot_id,
      quantity:row.quantity,reason:row.reason,recordedAt:row.created_at})),
  };
}
export async function getFoodState(): Promise<FoodState> {
  ensureEnabled();
  const session = await requireTeam(true);
  if (!session || session.mode !== "connected" || !session.canWrite)
    throw new Error("O acesso a distribuições exige staff/admin.");
  return readState(session.client);
}
const uuid = z.string().uuid();
const quantity = z.number().int().min(1).max(10000);
const basketQty = z.number().int().min(0).max(100);
async function invoke(name: "food_add_item" | "food_receive_stock" | "food_update_basket" |
  "food_update_target" | "food_distribute" | "food_receive_lot" | "food_record_loss", args: Record<string, unknown>): Promise<FoodActionResponse> {
  try {
    ensureEnabled();
    const session = await requireTeam(true);
    if (!session || session.mode !== "connected" || !session.canWrite)
      return { ok: false, message: "A operação exige acesso staff/admin." };
    const result = await session.client.rpc(name, args);
    if (result.error) return { ok: false, message: "Não foi possível salvar. Confira seus dados, permissões e estoque." };
    return { ok: true, state: await readState(session.client), duplicate: result.data?.duplicate === true };
  } catch { return { ok: false, message: "Falha na conexão com o módulo de alimentos." }; }
}
export async function createFoodItem(input: unknown): Promise<FoodActionResponse> {
  const result = z.object({ requestId: uuid, name: z.string().trim().min(2).max(100),
    unit: z.string().trim().min(2).max(60), perBasket: basketQty }).safeParse(input);
  if (!result.success) return { ok: false, message: "Cadastro de alimento inválido." };
  const d = result.data;
  return invoke("food_add_item", { p_request_id: d.requestId, p_name: d.name,
    p_unit: d.unit, p_per_basket: d.perBasket });
}
const expiryDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s + "T12:00:00Z");
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10) === s;
}).nullable();
export async function receiveFoodStock(input: unknown): Promise<FoodActionResponse> {
  const result = z.object({ requestId: uuid, itemId: uuid, quantity, expiresOn:expiryDate }).safeParse(input);
  if (!result.success) return { ok: false, message: "Entrada ou data de validade inválida." };
  const d = result.data;
  return invoke("food_receive_lot", { p_request_id: d.requestId, p_item_id: d.itemId,
    p_quantity: d.quantity, p_expires_on:d.expiresOn });
}
export async function recordFoodLoss(input: unknown): Promise<FoodActionResponse> {
  const result = z.object({requestId:uuid,lotId:uuid,quantity,
    reason:z.enum(["expired","damaged","unfit","other"])}).safeParse(input);
  if (!result.success) return {ok:false,message:"Lote, quantidade ou motivo inválido."};
  const d=result.data;
  return invoke("food_record_loss",{p_request_id:d.requestId,p_lot_id:d.lotId,
    p_quantity:d.quantity,p_reason:d.reason});
}
export async function updateBasketItem(input: unknown): Promise<FoodActionResponse> {
  const result = z.object({ requestId: uuid, itemId: uuid, perBasket: basketQty }).safeParse(input);
  if (!result.success) return { ok: false, message: "Quantidade da cesta inválida." };
  const d = result.data;
  return invoke("food_update_basket", { p_request_id: d.requestId, p_item_id: d.itemId, p_per_basket: d.perBasket });
}
export async function updateMonthlyFamilies(input: unknown): Promise<FoodActionResponse> {
  const result = z.object({ requestId: uuid, monthlyFamilies: quantity }).safeParse(input);
  if (!result.success) return { ok: false, message: "Informe a quantidade mensal de famílias." };
  const d = result.data;
  return invoke("food_update_target", { p_request_id: d.requestId, p_monthly_families: d.monthlyFamilies });
}
export async function deliverFood(input: unknown): Promise<FoodActionResponse> {
  const result = z.object({ requestId: uuid, familyId: uuid }).safeParse(input);
  if (!result.success) return { ok: false, message: "Família ou identificador de entrega inválido." };
  const d = result.data;
  return invoke("food_distribute", { p_request_id: d.requestId, p_family_id: d.familyId });
}
