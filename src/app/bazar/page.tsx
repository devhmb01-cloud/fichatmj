"use client";

import Link from "next/link";
import { useBazarDemo } from "@/components/bazar/bazar-demo-context";
import { BAZAR_PRICES, formatBRL, salesTotal, stockTotal } from "@/lib/bazar/demo-model";

export default function BazarDashboard() {
  const { stock, sales, persistent } = useBazarDemo();
  const piecesSold = sales.reduce((total, sale) => total + sale.quantity, 0);
  return (
    <section className="bazar-content" aria-labelledby="bazar-dashboard-title">
      <div className="bazar-heading">
        <div>
          <h2 id="bazar-dashboard-title">Visão geral</h2>
          <p>Acompanhe as quantidades e vendas do bazar, sem cadastro individual de peças.</p>
        </div>
      </div>
      <div className="bazar-metrics">
        <article className="bazar-metric">
          <span>Peças disponíveis</span>
          <strong>{stockTotal(stock)}</strong>
          <small>{persistent ? "Estoque registrado" : "Estoque demonstrativo"}</small>
        </article>
        <article className="bazar-metric">
          <span>{persistent ? "Arrecadação registrada*" : "Arrecadação simulada"}</span>
          <strong>{formatBRL(salesTotal(sales))}</strong>
          <small>{sales.length} venda(s) registrada(s)</small>
        </article>
        <article className="bazar-metric">
          <span>Peças vendidas</span>
          <strong>{piecesSold}</strong>
          <small>{persistent ? "No histórico consultado" : "Desde a abertura desta página"}</small>
        </article>
      </div>
      <div className="bazar-actions">
        <Link href="/bazar/vendas" className="bazar-primary-action">+ Registrar venda</Link>
        <Link href="/bazar/estoque" className="bazar-secondary-action">+ Registrar entrada</Link>
      </div>
      <div className="bazar-panel">
        <div className="bazar-panel-title">
          <h3>Peças por preço</h3>
          <span>{persistent ? "Contagem registrada" : "Contagem fictícia"}</span>
        </div>
        <div className="bazar-price-grid">
          {BAZAR_PRICES.map((price) => (
            <div className="bazar-price-tile" key={price}>
              <span>{formatBRL(price)}</span>
              <strong>{stock[price]}</strong>
              <small>peças</small>
            </div>
          ))}
        </div>
      </div>
      {persistent && <p className="bazar-muted">* Os totais representam as últimas 1.000 vendas disponíveis no histórico.</p>}
    </section>
  );
}
