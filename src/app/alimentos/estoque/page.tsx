"use client";
import { useEffect, useRef, useState } from "react";
import { useFood } from "@/components/alimentos/food-context";
import { foodMetrics } from "@/lib/alimentos/model";
export default function FoodStock() {
  const { data, addItem, receive, pending } = useFood();
  const [newName, setNewName] = useState("");
  const [unit, setUnit] = useState("pacote de 1 kg");
  const [perBasket, setPerBasket] = useState("0");
  const [itemId, setItemId] = useState("");
  const preselectedFromLink = useRef(false);
  const [quantity, setQuantity] = useState("1");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const metrics = foodMetrics(data);
  useEffect(() => {
    if (preselectedFromLink.current) return;
    preselectedFromLink.current = true;
    const requested = new URLSearchParams(window.location.search).get("item");
    if (requested && data.items.some(item => item.id === requested)) setItemId(requested);
  }, [data.items]);
  const selectedItem = data.items.find(item => item.id === itemId);
  const selectedNeed = metrics.needs.find(item => item.itemId === itemId);
  return <section className="food-section" aria-labelledby="food-stock-title">
    <div className="food-heading-block"><h2 id="food-stock-title">Estoque de alimentos</h2><p>Cadastre os produtos e registre cada doação por embalagem recebida.</p></div>
    <div className="food-duo">
      <article className="food-card" id="food-receive-form"><h3>Registrar entrada</h3><p className="food-muted">Escolha o alimento, indique quantas embalagens chegaram e confirme.</p><form className="food-form" onSubmit={async event => {
        event.preventDefault(); const r = await receive(itemId, Number(quantity)); setFeedback(r); if (r.ok) setQuantity("1");
      }}>
        <label>Alimento<select required value={itemId} onChange={event => setItemId(event.target.value)}><option value="">Selecione um alimento</option>{data.items.map(item => <option value={item.id} key={item.id}>{item.name} · {item.unit}</option>)}</select></label>
        {selectedItem && <div className="food-selected-stock" role="status"><strong>{selectedItem.stock} embalagens em estoque</strong><small>{selectedNeed?.missingNextMonth ? `Faltam ${selectedNeed.missingNextMonth} para atender a meta de um mês.` : "Sem falta prevista para o próximo mês."}</small></div>}
        <label>Quantidade de embalagens<input type="number" required min="1" max="10000" step="1" inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value)}/></label>
        <div className="food-quick-quantities" role="group" aria-label="Quantidades rápidas">
          {[1, 5, 10].map(amount => <button key={amount} type="button" className={quantity === String(amount) ? "food-quick-quantity is-selected" : "food-quick-quantity"} aria-pressed={quantity === String(amount)} onClick={() => setQuantity(String(amount))}>{amount} {amount === 1 ? "embalagem" : "embalagens"}</button>)}
        </div>
        <button disabled={pending || !itemId} className="food-primary" type="submit">Adicionar ao estoque</button>
      </form></article>
      <article className="food-card"><h3>Novo alimento</h3><form className="food-form" onSubmit={async event => {
        event.preventDefault(); const r = await addItem(newName, unit, Number(perBasket)); setFeedback(r); if(r.ok) { setNewName(""); setPerBasket("0"); }
      }}>
        <label>Nome<input required maxLength={100} placeholder="Ex.: Sardinha" value={newName} onChange={event => setNewName(event.target.value)}/></label>
        <label>Embalagem/unidade<input required maxLength={60} placeholder="Ex.: lata de 125 g" value={unit} onChange={event => setUnit(event.target.value)}/></label>
        <label>Unidades por cesta padrão (0 = fora da cesta)<input type="number" required min="0" max="100" step="1" inputMode="numeric" value={perBasket} onChange={event => setPerBasket(event.target.value)}/></label>
        <button disabled={pending} className="food-secondary" type="submit">Cadastrar alimento</button>
      </form></article>
    </div>
    {feedback && <p role="status" className={feedback.ok ? "food-success" : "food-error"}>{feedback.message}</p>}
    <article className="food-card"><div className="food-card-heading"><h3>Saldo atual</h3><strong>{metrics.totalPackages} embalagens</strong></div>
      <div className="food-stock-grid">{data.items.map(item => <div key={item.id} className="food-stock-line"><div><strong>{item.name}</strong><small>{item.unit}</small></div><span>{item.stock}</span></div>)}</div>
      <p className="food-muted">Os saldos consideram entradas e baixas por cestas distribuídas. A unidade de contagem é a embalagem cadastrada.</p>
    </article>
  </section>;
}
