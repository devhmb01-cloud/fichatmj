"use client";
import { useState } from "react";
import { useFood } from "@/components/alimentos/food-context";
import { foodMetrics } from "@/lib/alimentos/model";
export default function FoodDeliveries() {
  const { data, deliver, pending } = useFood();
  const [familyId, setFamilyId] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [ack, setAck] = useState(false);
  const metrics = foodMetrics(data);
  const items = data.items.filter(item => item.perBasket > 0);
  const familyById = new Map(data.families.map(f => [f.id, f.code]));
  return <section className="food-section" aria-labelledby="food-deliveries-title">
    <div className="food-heading-block"><h2 id="food-deliveries-title">Distribuição de cestas</h2><p>Vincule a entrega ao código de cadastro da família, sem duplicar seus dados pessoais.</p></div>
    <div className="food-duo"><article className="food-card"><h3>Registrar entrega</h3>
      <form className="food-form" onSubmit={async event => {
        event.preventDefault(); if (!ack) return;
        const r = await deliver(familyId); setFeedback(r); if (r.ok) {setFamilyId("");setAck(false);}
      }}>
        <label>Família<select required value={familyId} onChange={event => { setFamilyId(event.target.value); setFeedback(null); }}><option value="">Selecione pelo código</option>{data.families.map(f => <option key={f.id} value={f.id}>{f.code}</option>)}</select></label>
        {data.families.length === 0 && <p className="food-muted">Nenhuma família cadastrada neste ambiente. Cadastre primeiro uma família para registrar sua cesta.</p>}
        <label className="food-confirm"><input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)}/> Confirmo que a cesta foi entregue à família selecionada.</label>
        <button type="submit" className="food-primary" disabled={pending || !familyId || !ack || metrics.basketsPossible === 0}>Confirmar entrega e baixar estoque</button>
      </form>
    </article><article className="food-card"><h3>Conteúdo que será entregue</h3>
      {items.length ? <ul className="food-contents">{items.map(item => <li key={item.id}><span>{item.name} <small>({item.unit})</small></span><strong>{item.perBasket} un.</strong></li>)}</ul> : <p className="food-muted">Configure a cesta padrão.</p>}
      <p className="food-muted">Cada entrega consome uma cesta completa. Uma família só pode receber um registro por mês nesta versão.</p>
    </article></div>
    {feedback && <p role="status" className={feedback.ok ? "food-success" : "food-error"}>{feedback.message}</p>}
    <article className="food-card"><div className="food-card-heading"><h3>Histórico de entregas</h3><span className="food-count">{data.distributions.length} registros</span></div>
      {!data.distributions.length ? <p className="food-muted">Nenhuma entrega cadastrada ainda.</p> :
        <ol className="food-history">{data.distributions.map(d => <li key={d.id}>
          <div><strong>{familyById.get(d.familyId) ?? "Família cadastrada"}</strong><small>{new Date(d.deliveredAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</small><small>{d.lines.map(line=>`${line.name}: ${line.quantity}`).join(" · ")}</small></div><span>1 cesta</span>
        </li>)}</ol>}
    </article>
  </section>;
}
