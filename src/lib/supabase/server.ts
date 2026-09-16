import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
// Preparação para Route Handlers / Server Actions. A autenticação e o proxy
// de renovação de sessão devem ser implementados antes de conectar dados reais.
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        values.forEach(({ name, value, options }) =>
          store.set(name, value, options),
        );
      },
    },
  });
}
