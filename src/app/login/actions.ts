"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginErrorMessage, safeLoginDiagnostic } from "@/lib/login-error";

export async function signIn(_previous: { error: string }, form: FormData) {
  const email = form.get("email");
  const password = form.get("password");
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 254 ||
    password.length > 256 ||
    !email.trim() ||
    !password
  )
    return { error: "Informe seu email e senha." };
  const client = await createClient();
  if (!client)
    return { error: "O acesso da equipe ainda não foi configurado." };
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    console.warn("[auth.signIn] failed", safeLoginDiagnostic(error));
    return { error: loginErrorMessage(error) };
  }
  if (!data.user || data.user.is_anonymous)
    return {
      error:
        "Não foi possível entrar. Verifique os dados ou tente novamente mais tarde.",
    };
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (
    profileError ||
    !profile ||
    !["admin", "staff", "viewer"].includes(profile.role)
  ) {
    console.warn("[auth.profile] denied", {
      code: profileError?.code ?? "profile_not_authorized",
    });
    await client.auth.signOut({ scope: "local" });
    return {
      error: "Acesso não autorizado. Solicite a liberação à organização.",
    };
  }
  redirect("/");
}

export async function signOut() {
  const client = await createClient();
  if (client) await client.auth.signOut({ scope: "local" });
  redirect("/login");
}
