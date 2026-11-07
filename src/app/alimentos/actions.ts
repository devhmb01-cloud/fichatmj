"use server";
import { z } from "zod";
import { requireTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type FoodState, type FoodItem, type FoodDistributionLine } from "@/lib/alimentos/model";

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
  const [items, families, deliveries, settings] = await Promise.all([
    client.from("food_items").select("id,name,unit,stock,per_basket").order("name"),
    // Only family identifier and internal code; do not copy health, address or contact data.
    client.from("families").select("id,family_code").order("family_code").limit(1000),
    client.from("food_distributions").select("id,family_id,lines,delivered_at")
      .order("delivered_at", { ascending: false }).limit(300),
    client.from("food_settings").select("monthly_families").eq("id", 1).single(),
  ]);
  if (items.error || families.error || deliveries.error || settings.error || !settings.data) {
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
  "food_update_target" | "food_distribute", args: Record<string, unknown>): Promise<FoodActionResponse> {
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
export async function receiveFoodStock(input: unknown): Promise<FoodActionResponse> {
  const result = z.object({ requestId: uuid, itemId: uuid, quantity }).safeParse(input);
  if (!result.success) return { ok: false, message: "Entrada inválida." };
  const d = result.data;
  return invoke("food_receive_stock", { p_request_id: d.requestId, p_item_id: d.itemId, p_quantity: d.quantity });
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
