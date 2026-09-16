"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTeamSession } from "@/lib/auth";
import { calculateAge } from "@/lib/date";
import { statuses } from "@/lib/families/validation";

export async function addNote(input: unknown) {
  const session = await getTeamSession();
  if (session.mode !== "connected" || !session.canWrite)
    return {
      ok: false,
      message:
        "Sessão expirada ou acesso insuficiente. Entre em outra aba e tente novamente.",
    };
  const parsed = z
    .object({
      id: z.uuid(),
      familyId: z.uuid(),
      content: z.string().trim().min(1).max(5000),
    })
    .safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Escreva uma observação com até 5.000 caracteres.",
    };
  const { id, familyId, content } = parsed.data;
  const { error } = await session.client
    .from("family_notes")
    .upsert(
      { id, family_id: familyId, author_id: session.user.id, content },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (error)
    return {
      ok: false,
      message: "Não foi possível confirmar a observação. Tente novamente.",
    };
  revalidatePath(`/familias/${familyId}`);
  return { ok: true, message: "Observação registrada." };
}

export async function updateStatus(input: unknown) {
  const session = await getTeamSession();
  if (session.mode !== "connected" || !session.canWrite)
    return {
      ok: false,
      message:
        "Sessão expirada ou acesso insuficiente. Entre em outra aba e tente novamente.",
    };
  const parsed = z
    .object({
      id: z.uuid(),
      updatedAt: z.string().datetime({ offset: true }),
      status: z.enum(statuses),
      activationDate: z.string().refine((v) => !v || calculateAge(v) !== null),
    })
    .refine((v) => v.status !== "ativa" || Boolean(v.activationDate))
    .safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message:
        "Informe uma situação e uma data de ativação válida para famílias ativas.",
    };
  const v = parsed.data;
  const { data, error } = await session.client
    .from("families")
    .update({ status: v.status, activation_date: v.activationDate || null })
    .eq("id", v.id)
    .eq("updated_at", v.updatedAt)
    .select("id")
    .maybeSingle();
  if (error)
    return { ok: false, message: "Não foi possível atualizar a situação." };
  if (!data)
    return {
      ok: false,
      message:
        "O cadastro foi alterado por outra pessoa ou não está disponível. Recarregue antes de tentar novamente.",
    };
  for (const path of ["/", "/familias", "/relatorios", `/familias/${v.id}`])
    revalidatePath(path);
  return { ok: true, message: "Situação atualizada." };
}
