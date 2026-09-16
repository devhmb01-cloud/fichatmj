import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getTeamSession = cache(async () => {
  const client = await createClient();
  if (!client) return { mode: "demo" as const };
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous)
    return { mode: "signed-out" as const };
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError)
    throw new Error("Não foi possível verificar seu acesso. Tente novamente.");
  if (!profile || !["viewer", "staff", "admin"].includes(profile.role))
    return { mode: "denied" as const };
  return {
    mode: "connected" as const,
    client,
    user: data.user,
    profile,
    canWrite: ["staff", "admin"].includes(profile.role),
  };
});

export async function requireTeam(write = false) {
  const session = await getTeamSession();
  if (session.mode === "signed-out") redirect("/login");
  if (session.mode === "denied") redirect("/acesso-negado");
  if (session.mode === "demo") return null;
  if (write && !session.canWrite) redirect("/acesso-negado");
  return session;
}
