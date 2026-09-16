export default function Reports() {
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
