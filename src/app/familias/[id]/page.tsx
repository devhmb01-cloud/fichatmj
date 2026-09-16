import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireTeam } from "@/lib/auth";
import { calculateAge } from "@/lib/date";
import { FamilyFollowUp } from "@/components/family-follow-up";
function Details({
  row,
  fields,
}: {
  row: Record<string, unknown>;
  fields: string[][];
}) {
  return (
    <dl className="detail-grid">
      {fields.map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>
            {typeof row[key] === "boolean"
              ? row[key]
                ? "Sim"
                : "Não"
              : String(row[key] ?? "—") || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export default async function FamilyDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireTeam();
  const { id } = await params;
  if (!session || !z.uuid().safeParse(id).success) notFound();
  const [familyResult, childResult, noteResult] = await Promise.all([
    session.client.from("families").select("*").eq("id", id).maybeSingle(),
    session.client
      .from("children")
      .select("*")
      .eq("family_id", id)
      .order("created_at")
      .order("id"),
    session.client
      .from("family_notes")
      .select("id, content, created_at")
      .eq("family_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (familyResult.error || childResult.error || noteResult.error)
    throw new Error("Não foi possível carregar a ficha.");
  const family = familyResult.data;
  if (!family) notFound();
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">ACOMPANHAMENTO FAMILIAR</p>
          <h1>{family.responsible_name}</h1>
          <p>{family.family_code}</p>
        </div>
        <Link className="button secondary" href="/familias">
          Voltar às famílias
        </Link>
      </header>
      <section className="card">
        <h2>Responsável familiar</h2>
        <Details
          row={{ ...family, age: calculateAge(family.responsible_birth_date) }}
          fields={[
            ["responsible_birth_date", "Nascimento"],
            ["age", "Idade"],
            ["phone", "Telefone"],
            ["email", "Email"],
            ["profession", "Profissão"],
            ["address", "Endereço"],
            ["city", "Cidade"],
            ["cep", "CEP"],
            ["housing_type", "Situação da casa"],
            ["housing_other", "Outra situação"],
            ["household_size", "Moradores"],
            ["working_people", "Pessoas trabalhando"],
            ["income_range", "Faixa de renda"],
            ["number_of_children", "Filhos"],
            ["status", "Situação"],
            ["activation_date", "Ativação"],
          ]}
        />
        <p>
          Cadastro:{" "}
          {new Date(family.created_at).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}{" "}
          · Última alteração:{" "}
          {new Date(family.updated_at).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}{" "}
          (Brasília)
        </p>
      </section>
      <section className="card">
        <h2>Crianças</h2>
        {!childResult.data?.length && <p>Nenhuma criança cadastrada.</p>}
        {childResult.data?.map((child) => (
          <article className="child-card" key={child.id}>
            <h3>{child.name}</h3>
            <Details
              row={{ ...child, age: calculateAge(child.birth_date) }}
              fields={[
                ["birth_date", "Nascimento"],
                ["age", "Idade"],
                ["clothing_size", "Roupa"],
                ["shoe_size", "Calçado"],
                ["uses_diaper", "Usa fralda"],
                ...(child.uses_diaper ? [["diaper_size", "Fralda"]] : []),
                ["has_special_needs", "Necessidade especial"],
                ...(child.has_special_needs
                  ? [
                      ["condition", "Condição"],
                      ["cid", "CID"],
                      ["in_treatment", "Em tratamento"],
                    ]
                  : []),
                ...(child.in_treatment
                  ? [["treatment_description", "Tratamento"]]
                  : []),
                ["studies", "Estuda"],
                ...(child.studies
                  ? [
                      ["school", "Escola"],
                      ["school_grade", "Série / ano"],
                      ["education_level", "Formação"],
                    ]
                  : []),
                ["additional_information", "Informações adicionais"],
              ]}
            />
          </article>
        ))}
      </section>
      {session.canWrite && (
        <FamilyFollowUp
          id={id}
          status={family.status}
          activationDate={family.activation_date || ""}
          updatedAt={family.updated_at}
        />
      )}
      <section className="card">
        <h2>Observações recentes</h2>
        <p>Até 50 observações mais recentes. Horários de Brasília.</p>
        {!noteResult.data?.length && <p>Nenhuma observação registrada.</p>}
        {noteResult.data?.map((note) => (
          <article className="note" key={note.id}>
            <time dateTime={note.created_at}>
              {new Date(note.created_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              })}
            </time>
            <p>{note.content}</p>
          </article>
        ))}
      </section>
    </>
  );
}
