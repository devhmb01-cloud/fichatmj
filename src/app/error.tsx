"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="card empty">
      <h1>Não foi possível carregar esta página</h1>
      <p>
        Tente novamente. Se o problema continuar, peça à administração para
        conferir a conexão e as migrations do banco.
      </p>
      <button className="button" onClick={reset}>
        Tentar novamente
      </button>
    </section>
  );
}
