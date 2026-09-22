import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3000",
  pretendToBeVisual: true,
});
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLFormElement",
  "FormData",
  "Event",
  "MouseEvent",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
globalThis.self = dom.window;
const React = await import("react");
const { render, screen, fireEvent, waitFor, within, cleanup } =
  await import("@testing-library/react");
const { FamilyEditor } = await import("../src/components/family-editor.tsx");
const { editSchema } = await import("../src/lib/families/edit-validation.ts");
const initial = {
  id: "00000000-0000-4000-8000-000000000001",
  updatedAt: "2026-09-21T01:00:00+00:00",
  family: {
    responsible_name: "TEST MOTHER",
    responsible_birth_date: "1990-01-01",
    phone: "",
    email: "",
    profession: "",
    address: "",
    city: "",
    cep: "",
    housing_type: "",
    housing_other: "",
    household_size: "2",
    working_people: "0",
    income_range: "",
    number_of_children: "1",
    activation_date: "",
    status: "em análise",
    notes: "",
    responsible_residence_status: "não informado",
    responsible_work_status: "não informado",
    responsible_situation_notes: "",
    responsible_health_notes: "",
    responsible_treatment_notes: "",
    responsible_education_notes: "",
  },
  children: [
    {
      id: "00000000-0000-4000-8000-000000000002",
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
      profession: "",
      residence_status: "mora na casa",
      work_status: "não se aplica",
      situation_notes: "",
    },
  ],
  members: [],
};
let observed;
let calls = 0;
render(
  React.createElement(FamilyEditor, {
    initial,
    saveAction: async (payload) => {
      observed = payload;
      calls++;
      return calls === 1
        ? {
            ok: false,
            message: "A ficha mudou. Confira antes de tentar novamente.",
          }
        : { ok: true, id: initial.id };
    },
  }),
);
const fill = (scope, label, value) =>
  fireEvent.change(scope.getByLabelText(label), { target: { value } });
assert.equal(
  screen.getByLabelText("Nome da mãe / responsável *").value,
  "TEST MOTHER",
);
fill(screen, "Nome da mãe / responsável *", "TEST UPDATED MOTHER");
fill(screen, "Saúde / condições da mãe ou responsável", "Follow-up");
fill(screen, "Tratamentos da mãe ou responsável", "Treatment updated");
fill(screen, "Escola / formação da mãe ou responsável", "Course");
const child = within(
  screen.getByRole("group", { name: "Filho(a) 1 · TEST CHILD" }),
);
fill(child, "Situação no domicílio", "não mora na casa");
fill(child, "Estuda?", "sim");
fill(child, "Escola *", "NEW SCHOOL");
assert.equal(
  child.queryByRole("button", { name: "Descartar novo membro" }),
  null,
);
fireEvent.click(screen.getByRole("button", { name: "Adicionar filho(a)" }));
const newChild = within(screen.getByRole("group", { name: "Filho(a) 2" }));
fill(newChild, "Nome *", "NEW CHILD");
fill(newChild, "Data de nascimento *", "2024-01-01");
fireEvent.click(screen.getByRole("button", { name: "Adicionar outro membro" }));
const member = within(screen.getByRole("group", { name: "Membro 1" }));
fill(member, "Nome *", "TEST GRANDMOTHER");
fill(member, "Data de nascimento *", "1960-01-01");
fill(member, "Vínculo com a família (pai, avó, tio…) *", "Avó");
fill(member, "Situação no domicílio", "falecido");
fill(member, "Situação de trabalho", "aposentado / pensionista");
fill(member, "Detalhes da situação / data da mudança", "TEST NOTE");
fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
await waitFor(() =>
  assert.match(screen.getByRole("alert").textContent, /A ficha mudou/),
);
assert.equal(
  screen.getByLabelText("Nome da mãe / responsável *").value,
  "TEST UPDATED MOTHER",
);
assert.equal(observed.children[0].id, initial.children[0].id);
assert.equal(observed.family.number_of_children, "2");
assert.equal(observed.members.length, 1);
await waitFor(() =>
  assert.equal(
    screen.getByRole("button", { name: "Salvar alterações" }).disabled,
    false,
  ),
);
assert.ok(editSchema.safeParse(observed).success);
assert.equal(
  editSchema.safeParse({
    ...observed,
    children: [...observed.children, observed.children[0]],
  }).success,
  false,
);
assert.equal(
  editSchema.safeParse({
    ...observed,
    family: { ...observed.family, responsible_residence_status: "invalid" },
  }).success,
  false,
);
fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
await waitFor(() =>
  assert.match(screen.getByRole("status").textContent, /Família atualizada/),
);
cleanup();
console.log(
  "PASS: edit form loads existing data, edits mother/child, adds child/relative, validates payload, retains drafts after conflicts, and confirms success.",
);
