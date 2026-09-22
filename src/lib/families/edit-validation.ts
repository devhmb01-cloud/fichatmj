import { z } from "zod";
import { childSchema, familySchema } from "./validation";

export const residenceStatuses = [
  "não informado",
  "mora na casa",
  "não mora na casa",
  "falecido",
] as const;
export const workStatuses = [
  "não informado",
  "trabalhando",
  "desempregado",
  "aposentado / pensionista",
  "não se aplica",
] as const;
const notes = z
  .string()
  .trim()
  .max(5000, "Use até 5.000 caracteres.")
  .transform((v) => v || null);
const profession = z
  .string()
  .trim()
  .max(200)
  .transform((v) => v || null);
const personExtras = z.object({
  id: z.uuid(),
  residence_status: z.enum(residenceStatuses),
  work_status: z.enum(workStatuses),
  profession,
  situation_notes: notes,
});
export const editSchema = z
  .object({
    id: z.uuid(),
    updatedAt: z.string().datetime({ offset: true }),
    family: z.intersection(
      familySchema,
      z.object({
        responsible_residence_status: z.enum(residenceStatuses),
        responsible_work_status: z.enum(workStatuses),
        responsible_situation_notes: notes,
        responsible_health_notes: notes,
        responsible_treatment_notes: notes,
        responsible_education_notes: notes,
      }),
    ),
    children: z.array(z.intersection(childSchema, personExtras)).max(30),
    members: z
      .array(
        z.intersection(
          z.intersection(childSchema, personExtras),
          z.object({
            relationship: z
              .string()
              .trim()
              .min(1, "Informe o vínculo com a família.")
              .max(200),
          }),
        ),
      )
      .max(100),
  })
  .superRefine((v, ctx) => {
    if (v.family.number_of_children !== v.children.length)
      ctx.addIssue({
        code: "custom",
        path: ["children"],
        message: "A quantidade de filhos deve corresponder às fichas.",
      });
    const ids = [...v.children, ...v.members].map((m) => m.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["members"],
        message: "Há membros repetidos na ficha.",
      });
  });

export type EditDraft = {
  id: string;
  updatedAt: string;
  family: Record<string, string>;
  children: Record<string, string>[];
  members: Record<string, string>[];
};

export function formRow(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      typeof value === "boolean"
        ? value
          ? "sim"
          : "não"
        : String(value ?? ""),
    ]),
  );
}
