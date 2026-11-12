"use server";

import { z } from "zod";
import { requireTeam } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BAZAR_PRICES, isBazarPrice, type BazarSale, type BazarStock } from "@/lib/bazar/demo-model";

export type BazarServerState = { stock: BazarStock; sales: BazarSale[] };
export type BazarActionResponse =
  | { ok: true; state: BazarServerState; duplicate: boolean }
  | { ok: false; message: string };

type Client = NonNullable<Awaited<ReturnType<typeof createClient>>>;

function ensureEnabled() {
  if (process.env.BAZAR_PERSISTENCE_ENABLED !== "true") {
    throw new Error("Persistência do Bazar ainda não foi ativada neste ambiente.");
  }
}

async function readBazarState(client: Client): Promise<BazarServerState> {
  ensureEnabled();
  const [inventory, history] = await Promise.all([
    client.from("bazar_inventory").select("price_cents,quantity").order("price_cents"),
    client.from("bazar_sales").select("id,created_at,lines,quantity,amount_cents")
      .order("created_at", { ascending: false }).limit(1000),
  ]);
  if (inventory.error || history.error) {
    throw new Error("Não foi possível consultar o Bazar. Verifique as tabelas e permissões.");
  }
  const stock = Object.fromEntries(BAZAR_PRICES.map(price => [price, 0])) as BazarStock;
  for (const row of inventory.data ?? []) {
    const price = row.price_cents / 100;
    if (isBazarPrice(price) && Number.isSafeInteger(row.quantity)) stock[price] = row.quantity;
  }
  const sales: BazarSale[] = (history.data ?? []).map(row => ({
    id: row.id,
    createdAt: row.created_at,
    quantity: row.quantity,
    amount: row.amount_cents / 100,
    lines: Array.isArray(row.lines) ? row.lines
      .filter((item: { price_cents?: unknown; quantity?: unknown }) =>
        typeof item.price_cents === "number" && isBazarPrice(item.price_cents / 100)
        && typeof item.quantity === "number" && Number.isSafeInteger(item.quantity))
      .map((item: { price_cents: number; quantity: number }) =>
        ({ price: item.price_cents / 100 as typeof BAZAR_PRICES[number], quantity: item.quantity })) : [],
  }));
  return { stock, sales };
}

export async function getBazarState(): Promise<BazarServerState> {
  ensureEnabled();
  const session = await requireTeam();
  if (!session || session.mode !== "connected") {
    throw new Error("Acesse com sua conta da equipe para consultar o Bazar.");
  }
  return readBazarState(session.client);
}

const requestId = z.string().uuid();
const price = z.number().int().refine(isBazarPrice);
const quantity = z.number().int().min(1).max(10000);

async function invoke(
  functionName: "bazar_add_stock" | "bazar_reprice_stock" | "bazar_checkout",
  args: Record<string, unknown>,
): Promise<BazarActionResponse> {
  try {
    ensureEnabled();
    const session = await requireTeam(true);
    if (!session || session.mode !== "connected" || !session.canWrite) {
      return { ok: false, message: "Entre com uma conta autorizada da equipe." };
    }
    const result = await session.client.rpc(functionName, args);
    if (result.error) {
      // Do not leak SQL internals to the browser.
      return { ok: false, message: "Operação recusada. Confira o estoque, sua permissão e tente novamente." };
    }
    return { ok: true, state: await readBazarState(session.client), duplicate: result.data?.duplicate === true };
  } catch {
    return { ok: false, message: "Não foi possível salvar no Bazar. Verifique sua conexão e tente novamente." };
  }
}

export async function addBazarPieces(input: unknown): Promise<BazarActionResponse> {
  const parsed = z.object({price, quantity, requestId}).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Preço, quantidade ou operação inválidos." };
  const { price: p, quantity: q, requestId: id } = parsed.data;
  return invoke("bazar_add_stock",{p_price_cents:p*100,p_quantity:q,p_request_id:id});
}

export async function repriceBazarPieces(input: unknown): Promise<BazarActionResponse> {
  const parsed = z.object({from:price, to:price, quantity, requestId}).refine(
    data => data.from !== data.to
  ).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Reprecificação inválida." };
  const { from, to, quantity: q, requestId: id } = parsed.data;
  return invoke("bazar_reprice_stock",{
    p_from_cents:from*100,p_to_cents:to*100,p_quantity:q,p_request_id:id
  });
}

export async function registerBazarSale(input: unknown): Promise<BazarActionResponse> {
  const parsed = z.object({
    requestId,
    lines: z.array(z.object({ price, quantity })).min(1).max(BAZAR_PRICES.length),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Itens da venda inválidos." };
  const unique = new Set(parsed.data.lines.map(line => line.price));
  if (unique.size !== parsed.data.lines.length) {
    return { ok: false, message: "Não repita o mesmo preço na venda." };
  }
  return invoke("bazar_checkout",{
    p_request_id:parsed.data.requestId,
    p_lines:parsed.data.lines.map(line => ({ price_cents:line.price*100, quantity:line.quantity }))
  });
}
