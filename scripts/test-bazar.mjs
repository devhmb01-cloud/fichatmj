import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDemoStock,
  checkoutDemoSale,
  formatBRL,
  initialDemoStock,
  repriceDemoStock,
  salesTotal,
  stockTotal,
} from "../src/lib/bazar/demo-model.ts";

test("dados iniciais são fictícios e cópias independentes", () => {
  const a = initialDemoStock();
  a[5] = 0;
  assert.equal(initialDemoStock()[5], 58);
});

test("entrada por preço adiciona lote sem mutar estoque anterior", () => {
  const old = initialDemoStock();
  const next = addDemoStock(old, 5, 4);
  assert.equal(next[5], old[5] + 4);
  assert.equal(old[5], 58);
});

test("entradas inválidas são rejeitadas", () => {
  for (const quantity of [0, -1, 2.2, Number.NaN, 10001]) {
    assert.throws(() => addDemoStock(initialDemoStock(), 5, quantity));
  }
  assert.throws(() => addDemoStock(initialDemoStock(), 99, 1));
});

test("reprecificação preserva a quantidade total", () => {
  const old = initialDemoStock();
  const next = repriceDemoStock(old, 5, 10, 4);
  assert.equal(next[5], old[5] - 4);
  assert.equal(next[10], old[10] + 4);
  assert.equal(stockTotal(next), stockTotal(old));
  assert.equal(old[5], 58);
});

test("reprecificação invalida não consome estoque", () => {
  const old = initialDemoStock();
  assert.throws(() => repriceDemoStock(old, 5, 5, 2));
  assert.throws(() => repriceDemoStock(old, 60, 5, 100));
  assert.equal(old[60], 2);
});

test("venda rápida calcula total e subtrai múltiplas faixas", () => {
  const old = initialDemoStock();
  const result = checkoutDemoSale(old, { 5: 2, 15: 1 });
  assert.equal(result.amount, 25);
  assert.equal(result.quantity, 3);
  assert.equal(result.nextStock[5], 56);
  assert.equal(result.nextStock[15], 30);
  assert.equal(stockTotal(result.nextStock), stockTotal(old) - 3);
});

test("venda bloqueia carrinho vazio, quantidade fracionária e estoque insuficiente", () => {
  assert.throws(() => checkoutDemoSale(initialDemoStock(), {}));
  assert.throws(() => checkoutDemoSale(initialDemoStock(), { 5: 0 }));
  assert.throws(() => checkoutDemoSale(initialDemoStock(), { 5: 1.5 }));
  assert.throws(() => checkoutDemoSale(initialDemoStock(), { 60: 3 }));
  assert.throws(() => checkoutDemoSale(initialDemoStock(), { 999: 1 }));
});

test("totalização de arrecadação e formatação", () => {
  assert.equal(salesTotal([{ id: "a", createdAt: "", lines: [], quantity: 1, amount: 25 }]), 25);
  assert.match(formatBRL(25), /25,00/);
});
