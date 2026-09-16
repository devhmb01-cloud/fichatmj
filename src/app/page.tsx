import Link from "next/link";
import { requireTeam } from "@/lib/auth";
import { getOverview } from "@/lib/families/queries";
export default async function Home() {
  const session = await requireTeam();
  const counts = session ? await getOverview(session.client) : null;
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">VISÃO GERAL</p>
          <h1>Cuidar começa por conhecer.</h1>
          <p>Organize o acolhimento e acompanhe cada família.</p>
        </div>
        {(!session || session.canWrite) && (
          <Link className="button" href="/novo">
            + Novo cadastro
          </Link>
        )}
      </header>
      <div className="stats">
        {[
          "Famílias cadastradas",
          "Famílias ativas",
          "Crianças acompanhadas",
          "Em análise",
        ].map((label, index) => (
          <section className="card" key={label}>
            <p>{label}</p>
            <strong className="stat">{counts?.[index] ?? "—"}</strong>
            <small>
              {session ? "Cadastros da organização" : "Aguardando integração"}
            </small>
          </section>
        ))}
      </div>
      <section className="card welcome">
        <span className="badge">UM NOVO COMEÇO</span>
        <h2>Um lugar para cada história</h2>
        <p>
          Cadastro, informações das crianças e acompanhamento familiar em um
          único espaço.
        </p>
        <Link className="button" href={session ? "/familias" : "/novo"}>
          {session ? "Acompanhar famílias →" : "Conhecer o formulário →"}
        </Link>
      </section>
      <section className="card">
        <h2>Próximos passos</h2>
        <div className="summary">
          <p>
            <b>01 · Cadastrar</b>
            <br />
            Conheça a família e sua composição.
          </p>
          <p>
            <b>02 · Acompanhar</b>
            <br />
            Organize observações e situação familiar.
          </p>
          <p>
            <b>03 · Entender</b>
            <br />
            Relatórios e exportações após a integração.
          </p>
        </div>
      </section>
    </>
  );
}
