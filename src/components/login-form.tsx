"use client";
import { useActionState } from "react";
import { signIn } from "@/app/login/actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return (
    <form action={action} className="card login-card">
      <h2>Entrar na sua conta</h2>
      <p>Acesso exclusivo à equipe autorizada.</p>
      <div className="form-grid">
        <label className="field">
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
          />
        </label>
        <label className="field">
          Senha
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="feedback">
          {state.error}
        </p>
      )}
      <div className="form-actions">
        <small>
          Precisa de acesso ou de uma nova senha? Fale com a administração da
          organização.
        </small>
        <button className="button" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </div>
    </form>
  );
}
