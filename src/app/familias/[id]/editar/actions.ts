"use server";
import { revalidatePath } from "next/cache";
import { getTeamSession } from "@/lib/auth";
import { editSchema } from "@/lib/families/edit-validation";
import type { RegistrationResult } from "@/lib/families/validation";

export async function editFamily(
  payload: unknown,
): Promise<RegistrationResult> {
  const session = await getTeamSession();
  if (session.mode !== "connected" || !session.canWrite)
    return {
      ok: false,
      message:
        "Sessão expirada ou acesso insuficiente. Entre em outra aba e tente novamente sem fechar este formulário.",
    };
  const parsed = editSchema.safeParse(payload);
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0].message };
  const { id, updatedAt, family, children, members } = parsed.data;
  const { notes, ...fields } = family;
  const { data, error } = await session.client.rpc("edit_family", {
    p_id: id,
    p_updated_at: updatedAt,
    p_family: fields,
    p_children: children,
    p_members: members,
    p_note: notes,
  });
  if (error || typeof data !== "string")
    return {
      ok: false,
      message:
        error?.code === "40001"
          ? "A ficha mudou desde que você abriu esta tela (ou seu último envio já foi salvo). Seus dados continuam aqui. Abra a ficha em outra aba para conferir e recarregue antes de editar novamente."
          : "Não foi possível confirmar as alterações. Seus dados continuam nesta tela. Confira a conexão e tente novamente.",
    };
  for (const path of [
    "/",
    "/familias",
    "/relatorios",
    `/familias/${id}`,
    `/familias/${id}/editar`,
  ])
    revalidatePath(path);
  return { ok: true, id: data };
}
