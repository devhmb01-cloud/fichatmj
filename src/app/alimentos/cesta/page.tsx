"use client";
import { useState } from "react";
import { useFood } from "@/components/alimentos/food-context";
import { foodMetrics } from "@/lib/alimentos/model";
export default function FoodBasket() {
  const { data, updateBasket, updateTarget, pending } = useFood();
  const [monthly, setMonthly] = useState(String(data.monthlyFamilies));
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const metrics = foodMetrics(data);
  return <section className="food-section" aria-labelledby="food-basket-title">
    <div className="food-heading-block"><h2 id="food-basket-title">Cesta padrão</h2><p>Defina as quantidades de cada alimento para uma família. A cesta entregue mantém um registro do conteúdo daquele dia.</p></div>
    <article className="food-card food-compact"><h3>Planejamento mensal</h3><form className="food-inline-form" onSubmit={async event => {
      event.preventDefault(); const r = await updateTarget(Number(monthly)); setFeedback(r);
    }}><label>Famílias atendidas por mês (estimativa)<input type="number" min="1" max="10000" step="1" inputMode="numeric" required value={monthly} onChange={event => setMonthly(event.target.value)}/></label><button className="food-secondary" disabled={pending} type="submit">Salvar meta</button></form>
      <p className="food-muted">Essa meta é usada nas previsões; não altera os cadastros ou o número de famílias existentes.</p>
    </article>
    <article className="food-card"><div className="food-card-heading"><div><h3>Composição por família</h3><p>Coloque zero para retirar um alimento da cesta padrão.</p></div><span className="food-count">{metrics.activeItems} produtos na cesta</span></div>
      <div className="food-basket-list">{data.items.map(item => <form key={item.id} className="food-basket-line" onSubmit={async event => {
        event.preventDefault(); const r = await updateBasket(item.id, Number(edits[item.id] ?? item.perBasket)); setFeedback(r);
      }}>
        <div><strong>{item.name}</strong><small>{item.unit} · {item.stock} em estoque</small></div>
        <label>Por cesta<input aria-label={`Unidades de ${item.name} por cesta`} type="number" min="0" max="100" step="1" inputMode="numeric" required value={edits[item.id] ?? String(item.perBasket)} onChange={event => setEdits(current => ({ ...current, [item.id]: event.target.value }))}/></label>
        <button type="submit" className="food-secondary" disabled={pending || (edits[item.id] ?? String(item.perBasket)) === String(item.perBasket)}>Salvar</button>
      </form>)}</div>
    </article>
    {feedback && <p role="status" className={feedback.ok ? "food-success" : "food-error"}>{feedback.message}</p>}
    <p className="food-footnote">Com a cesta atual, podem ser montadas <strong>{metrics.basketsPossible} cestas</strong>. A cobertura prevista é de <strong>{metrics.monthsCoverage?.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) ?? "—"} mês(es)</strong>.</p>
  </section>;
}
