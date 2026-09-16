"use server";
import { revalidatePath } from "next/cache";
import { getTeamSession } from "@/lib/auth";
import {
  registrationSchema,
  type RegistrationResult,
} from "@/lib/families/validation";

export async function registerFamily(
  payload: unknown,
): Promise<RegistrationResult> {
  const session = await getTeamSession();
  if (session.mode === "demo")
    return {
      ok: false,
      message:
        "Demonstração: o banco não está configurado e nenhum dado foi salvo.",
    };
  if (session.mode !== "connected" || !session.canWrite)
    return {
      ok: false,
      message:
        "Sessão expirada ou acesso insuficiente. Entre em outra aba e tente novamente sem fechar este formulário.",
    };
  const parsed = registrationSchema.safeParse(payload);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const { family, children, requestId } = parsed.data;
  const { notes, ...fields } = family;
  const { data, error } = await session.client.rpc("register_family", {
    p_request_id: requestId,
    p_family: fields,
    p_children: children,
    p_note: notes,
  });
  if (error || typeof data !== "string")
    return {
      ok: false,
      message:
        "Não foi possível confirmar o cadastro. Seus dados continuam nesta tela. Tente novamente; a repetição não duplica o cadastro.",
    };
  revalidatePath("/familias");
  revalidatePath("/");
  revalidatePath("/relatorios");
  return { ok: true, id: data };
}
