type LoginError = { code?: string; status?: number; name?: string };

export function loginErrorMessage(error: LoginError) {
  if (error.code === "invalid_credentials")
    return "Email ou senha incorretos. Use a senha do seu acesso ao Ficha TMJ.";
  if (error.code === "email_not_confirmed")
    return "Seu acesso ainda precisa ser confirmado. Fale com a administração.";
  if (error.status === 429 || error.code === "over_request_rate_limit")
    return "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.";
  return "O serviço de acesso está indisponível no momento. Tente novamente em instantes. Se continuar, avise a administração.";
}

// Never include provider messages, request bodies, emails, passwords or tokens.
export function safeLoginDiagnostic(error: LoginError) {
  return {
    code:
      typeof error.code === "string" && /^[a-z_]{1,80}$/.test(error.code)
        ? error.code
        : "unknown",
    status: typeof error.status === "number" ? error.status : null,
  };
}
