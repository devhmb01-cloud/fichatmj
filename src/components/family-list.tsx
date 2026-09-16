"use client";
import { useState } from "react";
import Link from "next/link";
import { searchFamilies } from "@/app/familias/actions";
import { statuses } from "@/lib/families/validation";
import type { FamilyListResult } from "@/lib/families/list-types";
export function FamilyList({
  initial,
}: {
  initial: Extract<FamilyListResult, { ok: true }>;
}) {
  const [result, setResult] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({ query: "", status: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function search(page: number, filters = applied) {
    setPending(true);
    setError("");
    try {
      const next = await searchFamilies({ ...filters, page });
      if (next.ok) {
        setResult(next);
        setApplied(filters);
      } else setError(next.message);
    } catch {
      setError(
        "A busca não pôde ser concluída. Tente novamente ou entre na sua conta em outra aba.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="card">
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          void search(1, { query, status });
        }}
      >
        <label className="field">
          Nome do responsável
          <input
            value={query}
            maxLength={80}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          Situação
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="button" disabled={pending}>
          {pending ? "Buscando…" : "Buscar"}
        </button>
      </form>
      {error && (
        <p role="alert" className="feedback">
          {error}
        </p>
      )}
      <p aria-live="polite">{result.count} família(s) encontrada(s)</p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Responsável</th>
              <th>Cidade</th>
              <th>Filhos</th>
              <th>Situação</th>
              <th>Acompanhamento</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.responsible_name}</td>
                <td>{row.city || "—"}</td>
                <td>{row.number_of_children}</td>
                <td>
                  <span className="badge">{row.status}</span>
                </td>
                <td>
                  <Link
                    href={`/familias/${row.id}`}
                    aria-label={`Abrir família de ${row.responsible_name}`}
                  >
                    Abrir ficha →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rows.length === 0 && (
        <p className="feedback">
          Nenhuma família encontrada para os filtros atuais.
        </p>
      )}
      <div className="form-actions">
        <button
          className="button secondary"
          disabled={pending || result.page === 1}
          onClick={() => void search(result.page - 1)}
        >
          Anterior
        </button>
        <span>
          Página {result.page} de {Math.max(1, Math.ceil(result.count / 20))}
        </span>
        <button
          className="button secondary"
          disabled={pending || result.page * 20 >= result.count}
          onClick={() => void search(result.page + 1)}
        >
          Próxima
        </button>
      </div>
    </section>
  );
}
