import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:3100";
const browser = await chromium.launch({
  headless: true,
  ...(existsSync("/usr/bin/google-chrome") ? { executablePath: "/usr/bin/google-chrome" } : { channel: "chrome" }),
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
mkdirSync("artifacts", { recursive: true });
async function captureMobile(name) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: "artifacts/" + name + ".png", fullPage: true });
}
try {
  await page.goto(baseUrl + "/bazar", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Bazar", level: 1 }).waitFor();
  await captureMobile("bazar-mobile-painel");

  await page.getByRole("link", { name: "Estoque", exact: true }).click();
  await page.getByRole("heading", { name: "Estoque por quantidade" }).waitFor();
  await page.locator("input[type=number]").first().fill("2");
  await page.getByRole("button", { name: "Adicionar lote fictício" }).click();
  assert.match(await page.locator(".bazar-stock-row").nth(1).innerText(), /60 peças/);
  await captureMobile("bazar-mobile-estoque");

  await page.getByRole("link", { name: "Vendas", exact: true }).click();
  await page.getByRole("heading", { name: "Venda rápida" }).waitFor();
  const rows = page.locator(".bazar-sale-row");
  await rows.nth(0).locator("button").nth(1).click();
  await rows.nth(0).locator("button").nth(1).click();
  await rows.nth(2).locator("button").nth(1).click();
  await page.getByRole("button", { name: "Confirmar venda fictícia" }).click();
  assert.match(await page.locator(".bazar-feedback-ok").innerText(), /3 peça/);
  await captureMobile("bazar-mobile-vendas");

  await page.getByRole("link", { name: "Painel", exact: true }).click();
  await page.getByRole("heading", { name: "Visão geral" }).waitFor();
  await page.locator(".bazar-metric").first().waitFor();
  const metrics = await page.locator(".bazar-metric").allInnerTexts();
  assert.match(metrics[0], /168/);
  assert.match(metrics[1], /25,00/);
  assert.match(metrics[2], /3/);

  for (const route of ["/bazar", "/bazar/estoque", "/bazar/vendas"]) {
    await page.goto(baseUrl + route, { waitUntil: "networkidle" });
    const sizes = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    assert.ok(sizes.scroll <= sizes.viewport + 1, "Horizontal overflow on " + route + ": " + JSON.stringify(sizes));
  }
  console.log("PASS: mobile 390x844 navigation, stock, sale, totals and no horizontal overflow.");
} finally {
  await browser.close();
}
