import { z } from "zod";
import { calculateAge, todayISO } from "../date";
export const statuses = ["ativa", "inativa", "em análise"] as const;
const text = (label: string, max = 200) =>
  z
    .string({ error: `${label}: informe um texto.` })
    .trim()
    .max(max, `${label}: máximo de ${max} caracteres.`);
const required = (label: string) =>
  text(label).min(1, `${label} é obrigatório.`);
const optional = (label: string, max = 200) =>
  text(label, max).transform((v) => v || null);
const birthDate = (label: string) =>
  z
    .string()
    .refine(
      (v) => calculateAge(v) !== null,
      `${label}: informe uma data válida, não futura.`,
    );
const integer = (label: string, min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, `${label}: informe um número inteiro.`)
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(min, `${label}: mínimo ${min}.`)
        .max(max, `${label}: máximo ${max}.`),
    );
const yesNo = z.enum(["sim", "não"]).transform((v) => v === "sim");
export const familySchema = z
  .object({
    responsible_name: required("Nome do responsável"),
    responsible_birth_date: birthDate("Nascimento do responsável"),
    phone: optional("Telefone"),
    email: z
      .union([z.literal(""), z.email("Informe um email válido.")])
      .transform((v) => v || null),
    profession: optional("Profissão"),
    address: optional("Endereço"),
    city: optional("Cidade"),
    cep: z
      .string()
      .regex(/^(?:\d{5}-?\d{3})?$/, "CEP inválido.")
      .transform((v) => v || null),
    housing_type: z
      .enum([
        "",
        "aluguel",
        "própria",
        "invasão/ocupação",
        "área de risco",
        "outro",
      ])
      .transform((v) => v || null),
    housing_other: optional("Situação da casa"),
    household_size: integer("Moradores", 1, 100),
    working_people: integer("Pessoas trabalhando", 0, 100),
    income_range: z
      .enum([
        "",
        "sem renda",
        "até 1 salário mínimo",
        "de 1 a 2 salários mínimos",
        "de 2 a 3 salários mínimos",
        "acima de 3 salários mínimos",
        "não informado",
      ])
      .transform((v) => v || null),
    number_of_children: integer("Quantidade de filhos", 0, 30),
    activation_date: z
      .string()
      .refine(
        (v) => !v || (calculateAge(v) !== null && v <= todayISO()),
        "Data de ativação inválida.",
      )
      .transform((v) => v || null),
    status: z.enum(statuses),
    notes: optional("Observações", 5000),
  })
  .superRefine((v, ctx) => {
    if (v.working_people > v.household_size)
      ctx.addIssue({
        code: "custom",
        path: ["working_people"],
        message: "Pessoas trabalhando não pode superar o total de moradores.",
      });
    if (v.housing_type === "outro" && !v.housing_other)
      ctx.addIssue({
        code: "custom",
        path: ["housing_other"],
        message: "Especifique a situação da casa.",
      });
    if (v.status === "ativa" && !v.activation_date)
      ctx.addIssue({
        code: "custom",
        path: ["activation_date"],
        message: "Informe a data de ativação para uma família ativa.",
      });
  })
  .transform((v) => ({
    ...v,
    housing_other: v.housing_type === "outro" ? v.housing_other : null,
  }));
export const childSchema = z
  .object({
    name: required("Nome da criança"),
    birth_date: birthDate("Nascimento da criança"),
    has_special_needs: yesNo,
    condition: optional("Condição"),
    cid: optional("CID"),
    in_treatment: yesNo,
    treatment_description: optional("Descrição do tratamento"),
    additional_information: optional("Informações adicionais", 5000),
    clothing_size: optional("Roupa"),
    shoe_size: optional("Calçado"),
    uses_diaper: yesNo,
    diaper_size: optional("Fralda"),
    studies: yesNo,
    school: optional("Escola"),
    school_grade: optional("Série"),
    education_level: optional("Formação"),
  })
  .superRefine((v, ctx) => {
    for (const [invalid, path, message] of [
      [
        v.has_special_needs && !v.condition,
        "condition",
        "Informe a doença / condição.",
      ],
      [
        v.has_special_needs && v.in_treatment && !v.treatment_description,
        "treatment_description",
        "Descreva o tratamento.",
      ],
      [
        v.uses_diaper && !v.diaper_size,
        "diaper_size",
        "Informe o tamanho da fralda.",
      ],
      [v.studies && !v.school, "school", "Informe o nome da escola."],
    ] as const)
      if (invalid) ctx.addIssue({ code: "custom", path: [path], message });
  })
  .transform((v) => ({
    ...v,
    condition: v.has_special_needs ? v.condition : null,
    cid: v.has_special_needs ? v.cid : null,
    in_treatment: v.has_special_needs && v.in_treatment,
    treatment_description:
      v.has_special_needs && v.in_treatment ? v.treatment_description : null,
    diaper_size: v.uses_diaper ? v.diaper_size : null,
    school: v.studies ? v.school : null,
    school_grade: v.studies ? v.school_grade : null,
    education_level: v.studies ? v.education_level : null,
  }));
export const registrationSchema = z
  .object({
    requestId: z.uuid(),
    family: familySchema,
    children: z.array(childSchema).max(30),
  })
  .superRefine((v, ctx) => {
    if (v.children.length !== v.family.number_of_children)
      ctx.addIssue({
        code: "custom",
        path: ["children"],
        message:
          "A quantidade de fichas deve corresponder à quantidade de filhos.",
      });
  });
export type RegistrationResult =
  { ok: true; id: string } | { ok: false; message: string };
