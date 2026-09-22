"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { calculateAge, todayISO } from "@/lib/date";
import {
  editSchema,
  residenceStatuses,
  workStatuses,
  type EditDraft,
} from "@/lib/families/edit-validation";
import type { RegistrationResult } from "@/lib/families/validation";

type Row = Record<string, string>;
type Spec = {
  key: string;
  label: string;
  type?: string;
  options?: readonly string[];
  required?: boolean;
  max?: number;
  min?: number;
};
const yesNo = ["não", "sim"];
function Fields({
  row,
  specs,
  onChange,
}: {
  row: Row;
  specs: Spec[];
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="form-grid">
      {specs.map(({ key, label, type, options, required, max, min }) => (
        <label className="field" key={key}>
          <span>
            {label}
            {required ? " *" : ""}
          </span>
          {options ? (
            <select
              value={row[key] ?? ""}
              required={required}
              onChange={(e) => onChange(key, e.target.value)}
            >
              {options.map((v) => (
                <option key={v} value={v}>
                  {v || "Selecione"}
                </option>
              ))}
            </select>
          ) : type === "textarea" ? (
            <textarea
              value={row[key] ?? ""}
              maxLength={5000}
              onChange={(e) => onChange(key, e.target.value)}
            />
          ) : (
            <input
              type={type || "text"}
              value={row[key] ?? ""}
              required={required}
              maxLength={key === "email" ? 254 : 200}
              min={min}
              max={type === "date" ? todayISO() : max}
              onChange={(e) => onChange(key, e.target.value)}
            />
          )}
        </label>
      ))}
    </div>
  );
}
function situationSpecs(prefix = ""): Spec[] {
  return [
    {
      key: prefix + "residence_status",
      label: "Situação no domicílio",
      options: residenceStatuses,
    },
    {
      key: prefix + "work_status",
      label: "Situação de trabalho",
      options: workStatuses,
    },
    {
      key: prefix + "situation_notes",
      label: "Detalhes da situação / data da mudança",
      type: "textarea",
    },
  ];
}
function emptyPerson(): Row {
  return {
    id: crypto.randomUUID(),
    name: "",
    birth_date: "",
    relationship: "",
    profession: "",
    residence_status: "não informado",
    work_status: "não informado",
    situation_notes: "",
    has_special_needs: "não",
    condition: "",
    cid: "",
    in_treatment: "não",
    treatment_description: "",
    additional_information: "",
    clothing_size: "",
    shoe_size: "",
    uses_diaper: "não",
    diaper_size: "",
    studies: "não",
    school: "",
    school_grade: "",
    education_level: "",
  };
}
function PersonEditor({
  row,
  other,
  onChange,
}: {
  row: Row;
  other: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const specs: Spec[] = [
    { key: "name", label: "Nome", required: true },
    {
      key: "birth_date",
      label: "Data de nascimento",
      type: "date",
      required: true,
    },
    ...(other
      ? [
          {
            key: "relationship",
            label: "Vínculo com a família (pai, avó, tio…)",
            required: true,
          },
        ]
      : []),
    { key: "profession", label: "Profissão" },
    ...situationSpecs(),
    {
      key: "has_special_needs",
      label: "Possui necessidade especial?",
      options: yesNo,
    },
    ...(row.has_special_needs === "sim"
      ? [
          { key: "condition", label: "Doença / condição", required: true },
          { key: "cid", label: "CID" },
          { key: "in_treatment", label: "Está em tratamento?", options: yesNo },
          ...(row.in_treatment === "sim"
            ? [
                {
                  key: "treatment_description",
                  label: "Descrição do tratamento",
                  required: true,
                },
              ]
            : []),
        ]
      : []),
    {
      key: "additional_information",
      label: "Outras informações de saúde / acompanhamento",
      type: "textarea",
    },
    { key: "clothing_size", label: "Tamanho de roupa" },
    { key: "shoe_size", label: "Número do calçado" },
    { key: "uses_diaper", label: "Usa fralda?", options: yesNo },
    ...(row.uses_diaper === "sim"
      ? [{ key: "diaper_size", label: "Tamanho da fralda", required: true }]
      : []),
    { key: "studies", label: "Estuda?", options: yesNo },
    ...(row.studies === "sim"
      ? [
          { key: "school", label: "Escola", required: true },
          { key: "school_grade", label: "Série / ano" },
          { key: "education_level", label: "Nível de ensino / formação" },
        ]
      : []),
  ];
  return (
    <>
      <p>
        Idade: {calculateAge(row.birth_date) ?? "—"} · Campos com * são
        obrigatórios.
      </p>
      <Fields row={row} specs={specs} onChange={onChange} />
    </>
  );
}

export function FamilyEditor({
  initial,
  saveAction,
}: {
  initial: EditDraft;
  saveAction: (payload: unknown) => Promise<RegistrationResult>;
}) {
  const [draft, setDraft] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  function familyChange(key: string, value: string) {
    setMessage("");
    setDraft((prev) => ({ ...prev, family: { ...prev.family, [key]: value } }));
  }
  function personChange(
    group: "children" | "members",
    index: number,
    key: string,
    value: string,
  ) {
    setMessage("");
    setDraft((prev) => ({
      ...prev,
      [group]: prev[group].map((p, i) =>
        i === index ? { ...p, [key]: value } : p,
      ),
    }));
  }
  function add(group: "children" | "members") {
    const row = emptyPerson();
    setMessage("");
    setDraft((prev) => ({ ...prev, [group]: [...prev[group], row] }));
  }
  function removeDraft(group: "children" | "members", id: string) {
    setDraft((prev) => ({
      ...prev,
      [group]: prev[group].filter((p) => p.id !== id),
    }));
  }
  function submit() {
    const payload = {
      ...draft,
      family: {
        ...draft.family,
        number_of_children: String(draft.children.length),
      },
    };
    const parsed = editSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const prefix =
        issue.path[0] === "children"
          ? `Filho(a) ${Number(issue.path[1]) + 1}: `
          : issue.path[0] === "members"
            ? `Membro ${Number(issue.path[1]) + 1}: `
            : "";
      setMessage(prefix + issue.message);
      return;
    }
    startTransition(async () => {
      setMessage("");
      try {
        const result = await saveAction(payload);
        if (result.ok) setSaved(true);
        else setMessage(result.message);
      } catch {
        setMessage(
          "Não foi possível confirmar o salvamento. Mantenha esta tela aberta e tente novamente. Se a sessão expirou, entre em outra aba.",
        );
      }
    });
  }
  if (saved)
    return (
      <section className="card" role="status">
        <h2>Família atualizada</h2>
        <p>Os dados da família e dos membros foram salvos.</p>
        <Link className="button" href={`/familias/${initial.id}`}>
          Voltar à ficha atualizada
        </Link>
      </section>
    );
  const familySpecs: Spec[] = [
    { key: "phone", label: "Telefone / celular", type: "tel" },
    { key: "email", label: "Email", type: "email" },
    { key: "address", label: "Endereço" },
    { key: "city", label: "Cidade" },
    { key: "cep", label: "CEP" },
    {
      key: "housing_type",
      label: "Situação da casa",
      options: [
        "",
        "aluguel",
        "própria",
        "invasão/ocupação",
        "área de risco",
        "outro",
      ],
    },
    ...(draft.family.housing_type === "outro"
      ? [
          {
            key: "housing_other",
            label: "Especifique a situação da casa",
            required: true,
          },
        ]
      : []),
    {
      key: "household_size",
      label: "Quantas pessoas moram na casa?",
      type: "number",
      required: true,
      min: 1,
      max: 100,
    },
    {
      key: "working_people",
      label: "Quantas pessoas estão trabalhando?",
      type: "number",
      required: true,
      min: 0,
      max: 100,
    },
    {
      key: "income_range",
      label: "Faixa de renda familiar",
      options: [
        "",
        "sem renda",
        "até 1 salário mínimo",
        "de 1 a 2 salários mínimos",
        "de 2 a 3 salários mínimos",
        "acima de 3 salários mínimos",
        "não informado",
      ],
    },
    {
      key: "status",
      label: "Situação da família",
      options: ["ativa", "inativa", "em análise"],
    },
    {
      key: "activation_date",
      label: "Data de ativação",
      type: "date",
      required: draft.family.status === "ativa",
    },
  ];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) submit();
      }}
      autoComplete="off"
    >
      <fieldset className="form-body family-editor" disabled={pending}>
        <section className="card">
          <h2>Dados da família</h2>
          <p>
            Revise o total de moradores e de pessoas trabalhando quando alguém
            entrar ou sair da casa. Filhos cadastrados: {draft.children.length}.
          </p>
          <Fields
            row={draft.family}
            specs={familySpecs}
            onChange={familyChange}
          />
        </section>
        <section className="card">
          <h2>Mãe / responsável</h2>
          <Fields
            row={draft.family}
            onChange={familyChange}
            specs={[
              {
                key: "responsible_name",
                label: "Nome da mãe / responsável",
                required: true,
              },
              {
                key: "responsible_birth_date",
                label: "Data de nascimento da mãe / responsável",
                required: true,
                type: "date",
              },
              { key: "profession", label: "Profissão" },
              ...situationSpecs("responsible_"),
              {
                key: "responsible_health_notes",
                label: "Saúde / condições da mãe ou responsável",
                type: "textarea",
              },
              {
                key: "responsible_treatment_notes",
                label: "Tratamentos da mãe ou responsável",
                type: "textarea",
              },
              {
                key: "responsible_education_notes",
                label: "Escola / formação da mãe ou responsável",
                type: "textarea",
              },
            ]}
          />
        </section>
        {(["children", "members"] as const).map((group) => (
          <section className="card" key={group}>
            <h2>
              {group === "children"
                ? "Filhos / filhas"
                : "Outros membros da família"}
            </h2>
            <p>
              Para registrar saída da casa ou falecimento, altere a situação no
              domicílio. A ficha do membro será mantida.
            </p>
            {!draft[group].length && <p>Nenhum membro nesta seção.</p>}
            {draft[group].map((person, index) => (
              <fieldset className="child-card" key={person.id}>
                <legend>
                  {group === "children" ? "Filho(a)" : "Membro"} {index + 1}
                  {person.name ? ` · ${person.name}` : ""}
                </legend>
                <PersonEditor
                  row={person}
                  other={group === "members"}
                  onChange={(key, value) =>
                    personChange(group, index, key, value)
                  }
                />
                {!initial[group].some((p) => p.id === person.id) && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => removeDraft(group, person.id)}
                  >
                    Descartar novo membro
                  </button>
                )}
              </fieldset>
            ))}
            <button
              type="button"
              className="button secondary"
              disabled={
                draft[group].length >= (group === "children" ? 30 : 100)
              }
              onClick={() => add(group)}
            >
              {group === "children"
                ? "Adicionar filho(a)"
                : "Adicionar outro membro"}
            </button>
          </section>
        ))}
        <section className="card">
          <h2>Registrar a mudança</h2>
          <Fields
            row={draft.family}
            onChange={familyChange}
            specs={[
              {
                key: "notes",
                label: "Nova observação sobre as alterações (opcional)",
                type: "textarea",
              },
            ]}
          />
          <p>
            As observações anteriores continuam na ficha. As alterações serão
            salvas juntas.
          </p>
          {message && (
            <p className="feedback" role="alert">
              {message}{" "}
              <a
                href={`/familias/${initial.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Conferir ficha em outra aba
              </a>
            </p>
          )}
          <div className="form-actions">
            <Link className="button secondary" href={`/familias/${initial.id}`}>
              Voltar sem salvar
            </Link>
            <button className="button" disabled={pending} type="submit">
              {pending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </section>
      </fieldset>
    </form>
  );
}
