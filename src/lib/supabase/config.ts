export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url && !key) return null;
  if (!url || !key)
    throw new Error(
      "Configuração Supabase incompleta. Informe URL e chave pública.",
    );
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    )
  ) {
    throw new Error("A URL do Supabase deve usar HTTPS.");
  }
  if (key.startsWith("sb_secret_"))
    throw new Error("Use somente a chave pública do Supabase.");
  return { url, key };
}
