import assert from "node:assert/strict";
import {
  loginErrorMessage,
  safeLoginDiagnostic,
} from "../src/lib/login-error.ts";
assert.match(
  loginErrorMessage({ code: "invalid_credentials", status: 400 }),
  /Email ou senha incorretos/,
);
assert.match(loginErrorMessage({ code: "email_not_confirmed" }), /confirmado/);
assert.match(loginErrorMessage({ status: 429 }), /Muitas tentativas/);
for (const error of [
  { status: 503 },
  { status: 401 },
  { name: "AuthRetryableFetchError" },
  {},
]) {
  assert.match(loginErrorMessage(error), /indisponível/);
  assert.doesNotMatch(loginErrorMessage(error), /incorretos/);
}
assert.deepEqual(
  safeLoginDiagnostic({
    code: "invalid_credentials",
    status: 400,
    message: "PASSWORD",
    email: "PRIVATE",
    password: "SECRET",
  }),
  { code: "invalid_credentials", status: 400 },
);
assert.deepEqual(safeLoginDiagnostic({ code: "PRIVATE@example.com" }), {
  code: "unknown",
  status: null,
});
console.log(
  "PASS: credential/service/rate-limit errors distinguished; diagnostics omit credentials.",
);
