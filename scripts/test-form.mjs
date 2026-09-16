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
  "Event",
  "MouseEvent",
]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
}
globalThis.self = dom.window;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(
  dom.window,
);
const React = await import("react");
const { render, screen, fireEvent, waitFor, cleanup } =
  await import("@testing-library/react");
const { FamilyForm } = await import("../src/components/family-form.tsx");
function fill(label, value) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
render(React.createElement(FamilyForm));
fill("Nome da mãe / responsável *", "TEST");
fill("Data de nascimento *", "2000-01-01");
assert.notEqual(screen.getByLabelText("Idade calculada").value, "—");
fill("Situação da casa", "outro");
assert.ok(screen.getByLabelText("Especifique a situação da casa *"));
fill("Especifique a situação da casa *", "TEST");
fill("Quantidade de filhos *", "2");
fireEvent.click(screen.getByRole("button", { name: "Próxima etapa →" }));
assert.equal(screen.getAllByLabelText("Nome da criança *").length, 2);
fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
fill("Quantidade de filhos *", "1");
fireEvent.click(screen.getByRole("button", { name: "Próxima etapa →" }));
fill("Nome da criança *", "TEST CHILD");
fill("Data de nascimento da criança *", "2020-01-01");
fill("Possui necessidade especial?", "sim");
fill("Doença / condição *", "TEST");
fill("Está em tratamento?", "sim");
fill("Descrição do tratamento *", "TEST");
fill("Usa fralda?", "sim");
fill("Tamanho da fralda *", "TEST");
fill("Estuda?", "sim");
fill("Nome da escola *", "TEST");
fireEvent.click(screen.getByRole("button", { name: "Próxima etapa →" }));
assert.notEqual(
  screen.getByLabelText("Data de cadastro").value,
  "Automática ao iniciar o preenchimento",
);
fireEvent.click(screen.getByRole("button", { name: "Concluir prévia" }));
assert.match(screen.getByRole("status").textContent, /não foram salvos/);
cleanup();
let calls = 0;
let observed;
let release;
const saveAction = async (payload) => {
  calls++;
  observed = payload;
  await new Promise((resolve) => {
    release = resolve;
  });
  return { ok: true, id: "00000000-0000-4000-8000-000000000001" };
};
render(React.createElement(FamilyForm, { saveAction }));
fill("Nome da mãe / responsável *", "TEST");
fill("Data de nascimento *", "2000-01-01");
fireEvent.click(screen.getByRole("button", { name: "Próxima etapa →" }));
fireEvent.click(screen.getByRole("button", { name: "Próxima etapa →" }));
fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
assert.equal(screen.getByRole("button", { name: "Salvando…" }).disabled, true);
assert.equal(calls, 1);
assert.equal(observed.children.length, 0);
release();
await waitFor(() =>
  assert.ok(screen.getByRole("link", { name: "Abrir acompanhamento" })),
);
cleanup();
dom.window.close();
console.log(
  "PASS: three-step form, automatic ages, dynamic children, conditional fields, demo completion and connected save state.",
);
