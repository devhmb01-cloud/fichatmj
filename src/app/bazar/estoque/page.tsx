"use client";

import { useState } from "react";
import { useBazarDemo } from "@/components/bazar/bazar-demo-context";
import { BAZAR_PRICES, formatBRL, stockTotal, type BazarPrice } from "@/lib/bazar/demo-model";

export default function BazarEstoque() {
  const { stock, addPieces, repricePieces } = useBazarDemo();
  const [price, setPrice] = useState<BazarPrice>(5);
  const [quantity, setQuantity] = useState("1");
  const [from, setFrom] = useState<BazarPrice>(5);
  const [to, setTo] = useState<BazarPrice>(10);
  const [repriceQuantity, setRepriceQuantity] = useState("1");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <section className="bazar-content" aria-labelledby="bazar-stock-title">
      <div className="bazar-heading">
        <h2 id="bazar-stock-title">Estoque por quantidade</h2>
        <p>Registre lotes por preço. Não é necessário cadastrar cada roupa.</p>
      </div>
      <div className="bazar-panel">
        <h3>Adicionar peças após a triagem</h3>
        <form className="bazar-form" onSubmit={(event) => {
          event.preventDefault();
          const result = addPieces(price, Number(quantity));
          setFeedback(result);
          if (result.ok) setQuantity("1");
        }}>
          <label>Preço da peça
            <select value={price} onChange={(event) => setPrice(Number(event.target.value) as BazarPrice)}>
              {BAZAR_PRICES.map((value) => <option key={value} value={value}>{formatBRL(value)}</option>)}
            </select>
          </label>
          <label>Quantidade
            <input type="number" inputMode="numeric" min="1" max="10000" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <button type="submit" className="bazar-primary-action">Adicionar lote fictício</button>
        </form>
      </div>
      <div className="bazar-panel">
        <h3>Reprecificar peças</h3>
        <p className="bazar-muted">Transfere quantidades de um preço para outro, sem duplicar o estoque.</p>
        <form className="bazar-form" onSubmit={(event) => {
          event.preventDefault();
          const result = repricePieces(from, to, Number(repriceQuantity));
          setFeedback(result);
          if (result.ok) setRepriceQuantity("1");
        }}>
          <label>Preço anterior
            <select value={from} onChange={(event) => setFrom(Number(event.target.value) as BazarPrice)}>
              {BAZAR_PRICES.map((value) => <option key={value} value={value}>{formatBRL(value)}</option>)}
            </select>
          </label>
          <label>Novo preço
            <select value={to} onChange={(event) => setTo(Number(event.target.value) as BazarPrice)}>
              {BAZAR_PRICES.map((value) => <option key={value} value={value}>{formatBRL(value)}</option>)}
            </select>
          </label>
          <label>Quantidade
            <input type="number" inputMode="numeric" min="1" max="10000" step="1" required value={repriceQuantity} onChange={(event) => setRepriceQuantity(event.target.value)} />
          </label>
          <button type="submit" className="bazar-secondary-action">Reprecificar na simulação</button>
        </form>
      </div>
      {feedback && <p role="status" className={feedback.ok ? "bazar-feedback-ok" : "bazar-feedback-error"}>{feedback.message}</p>}
      <div className="bazar-panel">
        <div className="bazar-panel-title"><h3>Saldo atual</h3><strong>{stockTotal(stock)} peças</strong></div>
        <div className="bazar-stock-list">
          {BAZAR_PRICES.map((value) => (
            <div className="bazar-stock-row" key={value}>
              <span>{formatBRL(value)}</span><strong>{stock[value]} peças</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
