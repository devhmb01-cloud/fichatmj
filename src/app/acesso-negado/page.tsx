import Link from "next/link";
export default function Denied() {
  return (
    <section className="card empty">
      <h1>Acesso restrito</h1>
      <p>
        Sua conta não tem permissão para esta operação. Solicite a liberação à
        administração da organização.
      </p>
      <Link className="button" href="/">
        Voltar ao início
      </Link>
    </section>
  );
}
