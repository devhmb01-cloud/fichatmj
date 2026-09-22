import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireTeam } from "@/lib/auth";
import { formRow } from "@/lib/families/edit-validation";
import { FamilyEditor } from "@/components/family-editor";
import { editFamily } from "./actions";

export default async function EditFamilyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireTeam(true);
  const { id } = await params;
  if (!session || !z.uuid().safeParse(id).success) notFound();
  // Read the version first: member changes after this read invalidate the save.
  const f = await session.client
    .from("families")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (f.error)
    throw new Error("Não foi possível carregar a família para edição.");
  if (!f.data) notFound();
  const [c, m] = await Promise.all([
    session.client
      .from("children")
      .select("*")
      .eq("family_id", id)
      .order("created_at")
      .order("id"),
    session.client
      .from("family_members")
      .select("*")
      .eq("family_id", id)
      .order("created_at")
      .order("id"),
  ]);
  if (f.error || c.error || m.error)
    throw new Error("Não foi possível carregar a família para edição.");
  if (!f.data) notFound();
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">ACOMPANHAMENTO FAMILIAR</p>
          <h1>Editar família</h1>
          <p>{f.data.responsible_name}</p>
        </div>
        <Link className="button secondary" href={`/familias/${id}`}>
          Voltar à ficha
        </Link>
      </header>
      <FamilyEditor
        initial={{
          id,
          updatedAt: f.data.updated_at,
          family: { ...formRow(f.data), notes: "" },
          children: (c.data ?? []).map(formRow),
          members: (m.data ?? []).map(formRow),
        }}
        saveAction={editFamily}
      />
    </>
  );
}
