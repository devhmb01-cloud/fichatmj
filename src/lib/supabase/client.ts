import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";
// Invocado somente quando a integração for ativada; nunca conecta no import.
export function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.key);
}
