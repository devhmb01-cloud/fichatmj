import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = ts.transpileModule(readFileSync("src/lib/date.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { calculateAge, todayISO } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const now = new Date(2026, 8, 16);
assert.equal(calculateAge("2000-09-16", now), 26);
assert.equal(calculateAge("2000-09-17", now), 25);
assert.equal(calculateAge("2026-09-17", now), null);
assert.equal(calculateAge("2025-02-29", now), null);
assert.equal(calculateAge("", now), null);
assert.equal(calculateAge("2020-02-29", new Date(2026, 1, 28)), 5);
assert.equal(calculateAge("2020-02-29", new Date(2026, 2, 1)), 6);
assert.equal(todayISO(now), "2026-09-16");
console.log(
  "PASS: birthday boundaries, leap dates, invalid dates and future birth dates.",
);
