"use client";

import { useState } from "react";
import { useBazarDemo } from "@/components/bazar/bazar-demo-context";
import { BAZAR_PRICES, checkoutDemoSale, formatBRL, type BazarCart, type BazarPrice } from "@/lib/bazar/demo-model";

const MAIN_PRICES: BazarPrice[] = [5, 10, 15];
const OTHER_PRICES = BAZAR_PRICES.filter((price) => !MAIN_PRICES.includes(price));

export default function BazarVendas() {
  const { stock, sales, registerSale, pending, persistent } = useBazarDemo();
  const [cart, setCart] = useState<BazarCart>({});
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [showOther, setShowOther] = useState(false);
  const quantities = BAZAR_PRICES.reduce((total, price) => total + (cart[price] ?? 0), 0);
  const amount = BAZAR_PRICES.reduce((total, price) => total + price * (cart[price] ?? 0), 0);

  function change(price: BazarPrice, delta: number) {
    setFeedback(null);
    setCart((current) => {
      const nextQuantity = Math.max(0, Math.min(stock[price], (current[price] ?? 0) + delta));
      const next = { ...current };
      if (nextQuantity === 0) delete next[price];
      else next[price] = nextQuantity;
      return next;
    });
  }

  async function confirmSale() {
    // O modelo de domínio valida novamente todos os itens antes do registro.
    try { checkoutDemoSale(stock, cart); }
    catch (error) {
      setFeedback({ ok: false, message: error instanceof Error ? error.message : "Venda inválida." });
      return;
    }
    const result = await registerSale(cart);
    setFeedback(result);
    if (result.ok) setCart({});
  }

  function priceRow(price: BazarPrice) {
    return (
      <div className="bazar-sale-row" key={price}>
        <div><strong>{formatBRL(price)}</strong><small>{stock[price]} disponível(is)</small></div>
        <div className="bazar-stepper">
          <button type="button" aria-label={`Remover peça de ${formatBRL(price)}`} disabled={!cart[price]} onClick={() => change(price, -1)}>−</button>
          <output aria-label={`Quantidade no carrinho para ${formatBRL(price)}`}>{cart[price] ?? 0}</output>
          <button type="button" aria-label={`Adicionar peça de ${formatBRL(price)}`} disabled={(cart[price] ?? 0) >= stock[price]} onClick={() => change(price, 1)}>+</button>
        </div>
      </div>
    );
  }

  return (
    <section className="bazar-content" aria-labelledby="bazar-sales-title">
      <div className="bazar-heading">
        <h2 id="bazar-sales-title">Venda rápida</h2>
        <p>Conte as peças por preço. Nenhum cliente ou produto individual precisa ser cadastrado.</p>
      </div>
      <div className="bazar-panel">
        <h3>Preços mais comuns</h3>
        <div className="bazar-sale-list">{MAIN_PRICES.map(priceRow)}</div>
        <button type="button" className="bazar-link-button" aria-expanded={showOther} onClick={() => setShowOther((current) => !current)}>
          {showOther ? "Ocultar outros preços" : "Mostrar outros preços (R$ 2, 8, 12, 30, 60)"}
        </button>
        {showOther && <div className="bazar-sale-list">{OTHER_PRICES.map(priceRow)}</div>}
      </div>
      <div className="bazar-checkout">
        <div><small>Peças no registro</small><strong>{quantities}</strong></div>
        <div><small>Total da venda</small><strong>{formatBRL(amount)}</strong></div>
        <button type="button" className="bazar-primary-action" disabled={quantities === 0 || pending} onClick={confirmSale}>
          {persistent ? "Confirmar venda" : "Confirmar venda fictícia"}
        </button>
        <button type="button" className="bazar-link-button" disabled={quantities === 0} onClick={() => { setCart({}); setFeedback(null); }}>Limpar seleção</button>
      </div>
      {feedback && <p role="status" className={feedback.ok ? "bazar-feedback-ok" : "bazar-feedback-error"}>{feedback.message}</p>}
      <div className="bazar-panel">
        <h3>{persistent ? "Últimas vendas registradas" : "Últimas vendas simuladas"}</h3>
        {sales.length === 0 ? <p className="bazar-muted">Nenhuma venda registrada ainda.</p> : (
          <ol className="bazar-history">
            {sales.slice(0, 5).map((sale) => <li key={sale.id}><span>{sale.quantity} peça(s) · {new Date(sale.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span><strong>{formatBRL(sale.amount)}</strong></li>)}
          </ol>
        )}
      </div>
    </section>
  );
}
