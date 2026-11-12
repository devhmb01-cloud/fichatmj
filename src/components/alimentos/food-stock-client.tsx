"use client";
import { useState } from "react";
import { useFood } from "@/components/alimentos/food-context";
import { foodMetrics, lotValidity, brazilToday, LOSS_REASON_LABELS, type FoodLossReason } from "@/lib/alimentos/model";
export default function FoodStockClient({ initialItemId }: { initialItemId: string }) {
  const { data, addItem, receive, recordLoss, confirmExpiry, pending } = useFood();
  const [newName, setNewName] = useState("");
  const [unit, setUnit] = useState("pacote de 1 kg");
  const [perBasket, setPerBasket] = useState("0");
  const [itemId, setItemId] = useState(initialItemId);
  const [quantity, setQuantity] = useState("1");
  const [expiry, setExpiry] = useState("");
  const [lossLot, setLossLot] = useState("");
  const [lossQty, setLossQty] = useState("1");
  const [lossReason, setLossReason] = useState<FoodLossReason>("expired");
  const [unknownLotId, setUnknownLotId] = useState("");
  const [reviewedExpiry, setReviewedExpiry] = useState("");
  const [confirmExpired, setConfirmExpired] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const metrics = foodMetrics(data);
  const selectedItem = data.items.find(item => item.id === itemId);
  const selectedNeed = metrics.needs.find(item => item.itemId === itemId);
  const activeLots = (data.lots ?? []).filter(l => l.remaining > 0);
  const lossCandidate = activeLots.find(l => l.id === lossLot);
  const unknownLots = activeLots.filter(l => l.expiresOn === null);
  const selectedUnknown = unknownLots.find(l=>l.id===unknownLotId);
  const newDateIsExpired = reviewedExpiry.length > 0 && reviewedExpiry < brazilToday();
  return <section className="food-section" aria-labelledby="food-stock-title">
    <div className="food-heading-block"><h2 id="food-stock-title">Estoque de alimentos</h2><p>Cadastre os produtos e registre cada doação por embalagem recebida.</p></div>
    <div className="food-duo">
      <article className="food-card" id="food-receive-form"><h3>Registrar entrada</h3><p className="food-muted">Escolha o alimento, indique quantas embalagens chegaram e confirme.</p><form className="food-form" onSubmit={async event => {
        event.preventDefault(); const r = await receive(itemId, Number(quantity), expiry || null); setFeedback(r); if (r.ok) {setQuantity("1");setExpiry("");}
      }}>
        <label>Alimento<select required value={itemId} onChange={event => setItemId(event.target.value)}><option value="">Selecione um alimento</option>{data.items.map(item => <option value={item.id} key={item.id}>{item.name} · {item.unit}</option>)}</select></label>
        {selectedItem && <div className="food-selected-stock" role="status"><strong>{selectedItem.stock} embalagens em estoque</strong><small>{selectedNeed?.missingNextMonth ? `Faltam ${selectedNeed.missingNextMonth} para atender a meta de um mês.` : "Sem falta prevista para o próximo mês."}</small></div>}
        <label>Quantidade de embalagens<input type="number" required min="1" max="10000" step="1" inputMode="numeric" value={quantity} onChange={event => setQuantity(event.target.value)}/></label>
        <div className="food-quick-quantities" role="group" aria-label="Quantidades rápidas">
          {[1, 5, 10].map(amount => <button key={amount} type="button" className={quantity === String(amount) ? "food-quick-quantity is-selected" : "food-quick-quantity"} aria-pressed={quantity === String(amount)} onClick={() => setQuantity(String(amount))}>{amount} {amount === 1 ? "embalagem" : "embalagens"}</button>)}
        </div>
        <label>Validade do lote (opcional)<input type="date" min={brazilToday()} value={expiry} onChange={event=>setExpiry(event.target.value)}/></label>
        <p className="food-muted">Confira a validade na embalagem. Se não souber, deixe em branco: o lote ficará sinalizado para conferência.</p>
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
    <article className="food-card"><div className="food-card-heading"><h3>Saldo atual</h3><strong>{metrics.usablePackages} disponíveis · {metrics.totalPackages} registradas</strong></div>
      <div className="food-stock-grid">{data.items.map(item => {const availability=lotValidity(data,item.id);return <div key={item.id} className="food-stock-line"><div><strong>{item.name}</strong><small>{item.unit} · {availability.expired ? `${availability.expired} vencidas · ` : ""}{availability.unknown ? `${availability.unknown} sem validade · ` : ""} ${availability.usable} utilizáveis</small></div><span>{item.stock}</span></div>;})}</div>
      <p className="food-muted">A quantidade registrada inclui lotes vencidos até que sejam baixados como perda. As cestas usam somente os lotes não vencidos.</p>
    </article>
    <article className="food-card" id="food-expiry-review">
      <div className="food-card-heading">
        <div><h3>Conferir validade dos lotes antigos</h3>
          <p>Informe a data encontrada na embalagem. A correção fica registrada com histórico e não altera a quantidade.</p></div>
        <span className="food-count">{unknownLots.length} lote(s) para conferir</span>
      </div>
      {unknownLots.length ? <form className="food-form" onSubmit={async event=>{
        event.preventDefault();
        if(newDateIsExpired && !confirmExpired) return;
        const result=await confirmExpiry(unknownLotId,reviewedExpiry);
        setFeedback(result);
        if(result.ok){setUnknownLotId("");setReviewedExpiry("");setConfirmExpired(false);}
      }}>
        <label>Lote sem validade<select required value={unknownLotId} onChange={event=>{
          setUnknownLotId(event.target.value);setReviewedExpiry("");setConfirmExpired(false);setFeedback(null);
        }}>
          <option value="">Selecione um lote para conferir</option>
          {unknownLots.map(l=>{
            const item=data.items.find(i=>i.id===l.itemId);
            return <option key={l.id} value={l.id}>{item?.name??"Alimento"} · {l.remaining} embalagens · {item?.unit??""}</option>;
          })}
        </select></label>
        {selectedUnknown && <p className="food-muted">Este lote possui {selectedUnknown.remaining} embalagens. Confirme a data impressa antes de salvar.</p>}
        <label>Data de validade encontrada<input required type="date" value={reviewedExpiry} onChange={event=>{
          setReviewedExpiry(event.target.value);setConfirmExpired(false);
        }}/></label>
        {newDateIsExpired && <div className="food-expiry-warning" role="alert">
          A data informada já passou. O lote deixará de contar como disponível para as cestas. Depois, registre a perda ou descarte.
          <label className="food-confirm"><input type="checkbox" checked={confirmExpired} onChange={event=>setConfirmExpired(event.target.checked)}/>
            Confirmo que a data vencida corresponde à embalagem.</label>
        </div>}
        <button type="submit" className="food-secondary" disabled={pending || !selectedUnknown || !reviewedExpiry || (newDateIsExpired && !confirmExpired)}>
          Confirmar validade e registrar no histórico
        </button>
      </form> : <p className="food-muted">Todos os lotes com saldo já possuem validade informada.</p>}
      {(data.expiryUpdates??[]).length>0 && <div className="food-loss-history">
        <h3>Últimas conferências de validade</h3>
        <ol>{data.expiryUpdates?.slice(0,6).map(update=>{
          const lot=data.lots?.find(l=>l.id===update.lotId);
          const name=data.items.find(item=>item.id===lot?.itemId)?.name??"Lote cadastrado";
          return <li key={update.id}><span>{name} · {update.newExpiresOn.split("-").reverse().join("/")}</span>
            <small>{new Date(update.recordedAt).toLocaleDateString("pt-BR")}</small></li>;
        })}</ol>
      </div>}
    </article>
    <article className="food-card" id="food-loss-form">
      <div className="food-card-heading"><div><h3>Registrar perda ou descarte</h3><p>Baixe embalagens vencidas, danificadas ou impróprias. O histórico é auditável.</p></div></div>
      <form className="food-form" onSubmit={async event=>{
        event.preventDefault();
        const r=await recordLoss(lossLot,Number(lossQty),lossReason);
        setFeedback(r);
        if(r.ok){setLossQty("1");setLossLot("");}
      }}>
        <label>Lote<select required value={lossLot} onChange={event=>{setLossLot(event.target.value);setFeedback(null);}}>
          <option value="">Selecione um lote com saldo</option>
          {activeLots.map(l=>{const item=data.items.find(i=>i.id===l.itemId);return <option key={l.id} value={l.id}>{item?.name??"Alimento"} · {l.remaining} embalagens · {l.expiresOn ? `Validade: ${l.expiresOn.split("-").reverse().join("/")}` : "Validade não informada"}</option>;})}
        </select></label>
        {lossCandidate && <p className="food-muted">Saldo deste lote: {lossCandidate.remaining} embalagens. O descarte não pode ultrapassar esse saldo.</p>}
        <label>Motivo<select value={lossReason} onChange={event=>setLossReason(event.target.value as FoodLossReason)}>
          {Object.entries(LOSS_REASON_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Embalagens descartadas<input required type="number" min="1" max={lossCandidate?.remaining??10000} step="1" inputMode="numeric" value={lossQty} onChange={event=>setLossQty(event.target.value)}/></label>
        <button type="submit" disabled={pending||!lossLot} className="food-secondary">Registrar perda e baixar estoque</button>
      </form>
      {(data.losses??[]).length>0 && <div className="food-loss-history"><h3>Últimas baixas</h3><ol>{data.losses?.slice(0,8).map(l=><li key={l.id}><span>{data.items.find(i=>i.id===l.itemId)?.name??"Alimento"} · {LOSS_REASON_LABELS[l.reason]}</span><strong>{l.quantity} un.</strong></li>)}</ol></div>}
    </article>
  </section>;
}
