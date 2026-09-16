import assert from "node:assert/strict";
import { registrationSchema } from "../src/lib/families/validation.ts";
const family = {
  responsible_name: "TEST",
  responsible_birth_date: "2000-01-01",
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
const child = {
  name: "TEST CHILD",
  birth_date: "2020-01-01",
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
const input = { requestId: crypto.randomUUID(), family, children: [] };
assert.equal(registrationSchema.parse(input).family.cep, null);
for (const invalid of [
  { ...input, family: { ...family, responsible_name: "  " } },
  { ...input, family: { ...family, working_people: "2" } },
  { ...input, family: { ...family, household_size: "" } },
  { ...input, family: { ...family, responsible_birth_date: "2099-01-01" } },
  { ...input, family: { ...family, number_of_children: "1" } },
  { ...input, family: { ...family, status: "ativa" } },
  { ...input, family: { ...family, housing_type: "outro" } },
  { ...input, family: { ...family, email: "invalid" } },
  {
    ...input,
    family: { ...family, number_of_children: "1" },
    children: [{ ...child, uses_diaper: "sim" }],
  },
  {
    ...input,
    family: { ...family, number_of_children: "1" },
    children: [{ ...child, studies: "sim" }],
  },
  {
    ...input,
    family: { ...family, number_of_children: "1" },
    children: [
      {
        ...child,
        has_special_needs: "sim",
        condition: "TEST",
        in_treatment: "sim",
      },
    ],
  },
])
  assert.equal(registrationSchema.safeParse(invalid).success, false);
const normalized = registrationSchema.parse({
  ...input,
  family: { ...family, number_of_children: "1", role: "admin" },
  children: [
    {
      ...child,
      condition: "DISCARD",
      cid: "DISCARD",
      in_treatment: "sim",
      treatment_description: "DISCARD",
      diaper_size: "DISCARD",
      school: "DISCARD",
    },
  ],
});
assert.equal(normalized.family.role, undefined);
assert.equal(normalized.children[0].condition, null);
assert.equal(normalized.children[0].in_treatment, false);
assert.equal(normalized.children[0].diaper_size, null);
assert.equal(normalized.children[0].school, null);
console.log(
  "PASS: full registration validation, conditional requirements, normalization and field allowlist.",
);
