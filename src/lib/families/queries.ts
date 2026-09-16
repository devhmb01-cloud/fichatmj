import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function getOverview(client: SupabaseClient) {
  const results = await Promise.all([
    client.from("families").select("id", { count: "exact", head: true }),
    client
      .from("families")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativa"),
    client.from("children").select("id", { count: "exact", head: true }),
    client
      .from("families")
      .select("id", { count: "exact", head: true })
      .eq("status", "em análise"),
  ]);
  if (results.some((result) => result.error))
    throw new Error("Não foi possível carregar os indicadores.");
  return results.map((result) => result.count ?? 0);
}
