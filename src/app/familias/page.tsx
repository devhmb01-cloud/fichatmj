import Link from "next/link";
export default function Families() {
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">CADASTROS</p>
          <h1>Famílias</h1>
          <p>Cada família, uma história para acompanhar.</p>
        </div>
        <Link className="button" href="/novo">
          + Novo cadastro
        </Link>
      </header>
      <section className="card empty">
        <div className="empty-icon">◎</div>
        <h2>Seu espaço de acolhimento está pronto</h2>
        <p>
          A listagem estará disponível após conectar o banco e configurar os
          acessos da equipe.
        </p>
        <Link className="button" href="/novo">
          Experimentar o cadastro
        </Link>
      </section>
    </>
  );
}
