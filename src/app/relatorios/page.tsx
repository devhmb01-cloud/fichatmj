import { requireTeam } from "@/lib/auth";
import { getOverview } from "@/lib/families/queries";
export default async function Reports() {
  const session = await requireTeam();
  const counts = session ? await getOverview(session.client) : null;
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">ACOMPANHAMENTO</p>
          <h1>Relatórios</h1>
          <p>Informações para orientar o cuidado.</p>
        </div>
        <span className="badge">EM PREPARAÇÃO</span>
      </header>
      {counts && (
        <section className="card">
          <h2>Situação das famílias</h2>
          <dl className="detail-grid">
            <div>
              <dt>Ativas</dt>
              <dd>{counts[1]}</dd>
            </div>
            <div>
              <dt>Em análise</dt>
              <dd>{counts[3]}</dd>
            </div>
            <div>
              <dt>Inativas</dt>
              <dd>{counts[0] - counts[1] - counts[3]}</dd>
            </div>
            <div>
              <dt>Crianças acompanhadas</dt>
              <dd>{counts[2]}</dd>
            </div>
          </dl>
        </section>
      )}
      <div className="summary">
        {[
          ["Panorama das famílias", "Situação e composição familiar."],
          [
            "Perfil das crianças",
            "Faixas etárias e necessidades de acompanhamento.",
          ],
          ["Exportação para Excel", "Exportação futura com acesso controlado."],
        ].map(([title, description]) => (
          <section key={title} className="card">
            <h2>{title}</h2>
            <p>{description}</p>
            <small>Disponível em uma próxima etapa</small>
          </section>
        ))}
      </div>
    </>
  );
}
