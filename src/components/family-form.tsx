"use client";
import { useRef, useState, type InputHTMLAttributes } from "react";
import { calculateAge, todayISO } from "@/lib/date";

type Child = {
  id: string;
  name: string;
  birth_date: string;
  has_special_needs: string;
  condition: string;
  cid: string;
  in_treatment: string;
  treatment_description: string;
  additional_information: string;
  clothing_size: string;
  shoe_size: string;
  uses_diaper: string;
  diaper_size: string;
  studies: string;
  school: string;
  school_grade: string;
  education_level: string;
};
const emptyChild = (): Child => ({
  id: crypto.randomUUID(),
  name: "",
  birth_date: "",
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
});
const initialFamily = {
  responsible_name: "",
  responsible_birth_date: "",
  phone: "",
  email: "",
  profession: "",
  address: "",
  city: "",
  cep: "",
  housing_type: "",
  housing_other: "",
  household_size: "1",
  working_people: "0",
  income_range: "",
  number_of_children: "0",
  activation_date: "",
  status: "em análise",
  notes: "",
};
type Family = typeof initialFamily;
function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>
        {label}
        {props.required ? " *" : ""}
      </span>
      <input {...props} />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <select
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      >
        {!options.includes("") ? null : <option value="">Selecione</option>}
        {options.filter(Boolean).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        maxLength={5000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
const titles = [
  "Responsável familiar",
  "Crianças",
  "Controle / acompanhamento",
];
export function FamilyForm() {
  const [step, setStep] = useState(0);
  const [family, setFamily] = useState<Family>(initialFamily);
  const [children, setChildren] = useState<Child[]>([]);
  const [created, setCreated] = useState("");
  const [updated, setUpdated] = useState("");
  const [message, setMessage] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  function touch() {
    const now = new Date().toISOString();
    setCreated((previous) => previous || now);
    setUpdated(now);
    setMessage("");
  }
  function change<K extends keyof Family>(key: K, value: Family[K]) {
    touch();
    setFamily((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "housing_type" && value !== "outro"
        ? { housing_other: "" }
        : {}),
    }));
  }
  function childChange(index: number, key: keyof Child, value: string) {
    touch();
    setChildren((previous) =>
      previous.map((c, i) =>
        i !== index
          ? c
          : {
              ...c,
              [key]: value,
              ...(key === "has_special_needs" && value === "não"
                ? {
                    condition: "",
                    cid: "",
                    in_treatment: "não",
                    treatment_description: "",
                  }
                : {}),
              ...(key === "in_treatment" && value === "não"
                ? { treatment_description: "" }
                : {}),
              ...(key === "uses_diaper" && value === "não"
                ? { diaper_size: "" }
                : {}),
              ...(key === "studies" && value === "não"
                ? { school: "", school_grade: "", education_level: "" }
                : {}),
            },
      ),
    );
  }
  function countChange(value: string) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 30) return;
    change("number_of_children", value);
    setChildren((previous) =>
      Array.from(
        { length: Math.max(previous.length, n) },
        (_, i) => previous[i] ?? emptyChild(),
      ),
    );
  }
  function valid() {
    if (!form.current?.reportValidity()) return false;
    if (
      step === 0 &&
      Number(family.working_people) > Number(family.household_size)
    ) {
      setMessage(
        "O número de pessoas trabalhando não pode superar o total de moradores.",
      );
      return false;
    }
    return true;
  }
  function navigate(next: number) {
    if (next > step + 1) {
      setMessage("Preencha a próxima etapa antes de continuar.");
      return;
    }
    if (next > step && !valid()) return;
    setStep(next);
    setMessage("");
    requestAnimationFrame(() => heading.current?.focus());
  }
  const field = (
    key: keyof Family,
    label: string,
    props: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <Field
      key={key}
      label={label}
      value={family[key]}
      onChange={(e) => change(key, e.target.value)}
      maxLength={200}
      {...props}
    />
  );
  const timestamp = (value: string) =>
    value
      ? new Date(value).toLocaleString("pt-BR")
      : "Automática ao iniciar o preenchimento";
  return (
    <>
      <div className="form-steps" aria-label="Etapas do cadastro">
        {titles.map((title, i) => (
          <button
            type="button"
            key={title}
            aria-current={step === i ? "step" : undefined}
            onClick={() => navigate(i)}
          >
            0{i + 1} · {title}
          </button>
        ))}
      </div>
      <form
        ref={form}
        className="card"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 2) {
            navigate(step + 1);
            return;
          }
          if (valid()) {
            setMessage(
              "Prévia concluída. Os dados permanecem somente nesta tela e não foram salvos. Ao sair ou recarregar, serão descartados.",
            );
          }
        }}
      >
        <h2 ref={heading} tabIndex={-1}>
          {titles[step]}
        </h2>
        <p>Etapa {step + 1} de 3 · Campos com * são obrigatórios.</p>
        {step === 0 && (
          <div className="form-grid">
            {field("responsible_name", "Nome da mãe / responsável", {
              required: true,
              pattern: ".*\\S.*",
            })}
            {field("responsible_birth_date", "Data de nascimento", {
              type: "date",
              max: todayISO(),
              required: true,
            })}
            <Field
              label="Idade calculada"
              readOnly
              value={
                calculateAge(family.responsible_birth_date) === null
                  ? "—"
                  : `${calculateAge(family.responsible_birth_date)} anos`
              }
            />
            {field("phone", "Telefone / celular", { type: "tel" })}
            {field("email", "Email", { type: "email" })}
            {field("profession", "Profissão")}
            {field("address", "Endereço")}
            {field("city", "Cidade")}
            {field("cep", "CEP", {
              pattern: "[0-9]{5}-?[0-9]{3}",
              placeholder: "00000-000",
              maxLength: 9,
            })}
            <Select
              label="Situação da casa"
              value={family.housing_type}
              options={[
                "",
                "aluguel",
                "própria",
                "invasão/ocupação",
                "área de risco",
                "outro",
              ]}
              onChange={(v) => change("housing_type", v)}
            />
            {family.housing_type === "outro" &&
              field("housing_other", "Especifique a situação da casa", {
                required: true,
              })}
            {field("household_size", "Quantas pessoas moram na casa?", {
              type: "number",
              min: 1,
              max: 100,
              required: true,
            })}
            {field("working_people", "Quantas pessoas estão trabalhando?", {
              type: "number",
              min: 0,
              max: Number(family.household_size),
              required: true,
            })}
            <Select
              label="Faixa de renda familiar"
              value={family.income_range}
              options={[
                "",
                "sem renda",
                "até 1 salário mínimo",
                "de 1 a 2 salários mínimos",
                "de 2 a 3 salários mínimos",
                "acima de 3 salários mínimos",
                "não informado",
              ]}
              onChange={(v) => change("income_range", v)}
            />
            <Field
              label="Quantidade de filhos"
              type="number"
              min={0}
              max={30}
              required
              value={family.number_of_children}
              onChange={(e) => countChange(e.target.value)}
            />
          </div>
        )}
        {step === 1 && (
          <>
            {Number(family.number_of_children) === 0 ? (
              <p className="feedback">
                Nenhuma criança informada. Ajuste a quantidade de filhos na
                primeira etapa, se necessário.
              </p>
            ) : (
              children
                .slice(0, Number(family.number_of_children))
                .map((child, index) => {
                  const cf = (
                    key: keyof Child,
                    label: string,
                    props: InputHTMLAttributes<HTMLInputElement> = {},
                  ) => (
                    <Field
                      key={key}
                      label={label}
                      maxLength={200}
                      value={child[key]}
                      onChange={(e) => childChange(index, key, e.target.value)}
                      {...props}
                    />
                  );
                  const yesNo = (key: keyof Child, label: string) => (
                    <Select
                      label={label}
                      value={child[key]}
                      options={["não", "sim"]}
                      onChange={(v) => childChange(index, key, v)}
                    />
                  );
                  return (
                    <fieldset className="child-card" key={child.id}>
                      <legend>Criança {index + 1}</legend>
                      <div className="form-grid">
                        {cf("name", "Nome da criança", {
                          required: true,
                          pattern: ".*\\S.*",
                        })}
                        {cf("birth_date", "Data de nascimento da criança", {
                          type: "date",
                          max: todayISO(),
                          required: true,
                        })}
                        <Field
                          label="Idade atual"
                          readOnly
                          value={
                            calculateAge(child.birth_date) === null
                              ? "—"
                              : `${calculateAge(child.birth_date)} anos`
                          }
                        />
                        {yesNo(
                          "has_special_needs",
                          "Possui necessidade especial?",
                        )}
                        {child.has_special_needs === "sim" && (
                          <>
                            {cf("condition", "Doença / condição", {
                              required: true,
                            })}
                            {cf("cid", "CID")}
                            {yesNo("in_treatment", "Está em tratamento?")}
                            {child.in_treatment === "sim" &&
                              cf(
                                "treatment_description",
                                "Descrição do tratamento",
                                { required: true },
                              )}
                          </>
                        )}
                        <TextArea
                          label="Informações adicionais"
                          value={child.additional_information}
                          onChange={(v) =>
                            childChange(index, "additional_information", v)
                          }
                        />
                        {cf("clothing_size", "Tamanho de roupa")}
                        {cf("shoe_size", "Número do calçado")}
                        {yesNo("uses_diaper", "Usa fralda?")}
                        {child.uses_diaper === "sim" &&
                          cf("diaper_size", "Tamanho da fralda", {
                            required: true,
                          })}
                        {yesNo("studies", "Estuda?")}
                        {child.studies === "sim" && (
                          <>
                            {cf("school", "Nome da escola", { required: true })}
                            {cf("school_grade", "Série / ano")}
                            {cf(
                              "education_level",
                              "Nível de ensino / formação",
                            )}
                          </>
                        )}
                      </div>
                    </fieldset>
                  );
                })
            )}
          </>
        )}
        {step === 2 && (
          <div className="form-grid">
            <Field
              label="Data de cadastro"
              readOnly
              value={timestamp(created)}
            />
            <Field
              label="Última modificação"
              readOnly
              value={timestamp(updated)}
            />
            {field("activation_date", "Data de ativação da família", {
              type: "date",
              max: todayISO(),
              required: family.status === "ativa",
            })}
            <Select
              label="Situação"
              value={family.status}
              options={["ativa", "inativa", "em análise"]}
              onChange={(v) => change("status", v)}
            />
            <TextArea
              label="Comentários / observações"
              value={family.notes}
              onChange={(v) => change("notes", v)}
            />
          </div>
        )}
        {message && (
          <div role="status" className="feedback">
            {message}
          </div>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => navigate(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            Voltar
          </button>
          <button type="submit" className="button">
            {step === 2 ? "Concluir prévia" : "Próxima etapa →"}
          </button>
        </div>
      </form>
    </>
  );
}
