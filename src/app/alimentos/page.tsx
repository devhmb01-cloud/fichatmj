"use client";
import Link from "next/link";
import { useFood } from "@/components/alimentos/food-context";
import { foodMetrics } from "@/lib/alimentos/model";
function coverage(value: number | null) { return value === null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 1 }); }
export default function FoodDashboard() {
  const { data } = useFood();
  const metrics = foodMetrics(data);
  return <section className="food-section" aria-labelledby="food-overview-title">
    <div className="food-heading-block"><h2 id="food-overview-title">Visão geral</h2><p>Veja quantas cestas completas podem ser montadas com o estoque disponível.</p></div>
    <div className="food-metrics">
      <article className="food-metric"><span>Meses de mantimentos</span><strong>{coverage(metrics.monthsCoverage)}</strong><small>Estimativa para {data.monthlyFamilies} famílias por mês</small></article>
      <article className="food-metric"><span>Cestas completas possíveis</span><strong>{metrics.basketsPossible}</strong><small>Limitadas pelo item com menor cobertura</small></article>
      <article className="food-metric"><span>Entregas registradas</span><strong>{metrics.deliveries}</strong><small>{metrics.familiesServed} família(s) atendida(s) no histórico</small></article>
    </div>
    <div className="food-safety-metrics" aria-label="Controle de validade">
      <div className="food-safety-card"><strong>{metrics.expiredPackages}</strong><span>Embalagens vencidas</span><small>Não entram no cálculo das cestas. Registre o descarte.</small></div>
      <div className="food-safety-card"><strong>{metrics.nearExpiryPackages}</strong><span>Vencem em até 30 dias</span><small>Priorize a distribuição antes da data de vencimento.</small></div>
      <div className="food-safety-card"><strong>{metrics.unknownExpiryPackages}</strong><span>Validade não informada</span><small>Confira as embalagens antes de distribuir.</small></div>
    </div>
    <div className="food-actions"><Link className="food-primary" href="/alimentos/estoque">+ Registrar doação</Link><Link className="food-secondary" href="/alimentos/entregas">+ Entregar cesta</Link></div>
    <article className="food-card">
      <div className="food-card-heading"><div><h3>Prioridade de reposição</h3><p>Itens com menor cobertura da demanda mensal estimada.</p></div><span className="food-count">{metrics.nextMonthShortages.length} em falta no próximo mês</span></div>
      {metrics.needs.length === 0 ? <p className="food-muted">Configure os alimentos da cesta padrão para calcular as prioridades.</p> :
        <div className="food-table-scroll"><table className="food-table"><thead><tr><th>Alimento</th><th>Estoque</th><th>Necessidade/mês</th><th>Falta para 1 mês</th></tr></thead><tbody>
          {metrics.needs.map(item => <tr key={item.itemId}><td><strong>{item.name}</strong><small>{item.unit} · {coverage(item.months)} mês(es)</small></td><td>{item.stock}</td><td>{item.neededPerMonth}</td><td><div className="food-replenish-actions"><span className={item.missingNextMonth ? "food-shortage" : "food-ok"}>{item.missingNextMonth ? `+ ${item.missingNextMonth}` : "Atendido"}</span>{item.missingNextMonth > 0 && <Link className="food-replenish-link" href={`/alimentos/estoque?item=${encodeURIComponent(item.itemId)}#food-receive-form`} aria-label={`Repor ${item.name}`}>Repor</Link>}</div></td></tr>)}
        </tbody></table></div>}
    </article>
    <div className="food-footnote">Cálculo: cestas possíveis = mínimo de estoque ÷ quantidade por cesta, arredondado para baixo. Meses = cestas possíveis ÷ famílias atendidas por mês. Exclui lotes vencidos, considera perdas registradas e não inclui doações futuras. Validades desconhecidas exigem conferência manual.</div>
  </section>;
}
