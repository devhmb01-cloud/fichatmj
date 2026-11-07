"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFood } from "@/components/alimentos/food-context";
import type { ReactNode } from "react";
const links = [
  { href: "/alimentos", label: "Painel" },
  { href: "/alimentos/estoque", label: "Estoque" },
  { href: "/alimentos/cesta", label: "Cesta padrão" },
  { href: "/alimentos/entregas", label: "Entregas" },
];
export function FoodShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { persistent, resetDemo } = useFood();
  const staging = process.env.NEXT_PUBLIC_FOOD_STAGING === "true";
  return <div className="food-page">
    <header className="food-heading">
      <div><p className="food-eyebrow">Ficha TMJ / Assistência alimentar</p><h1>Alimentos e Cestas</h1></div>
      <span className="food-pill">{staging ? "Teste conectado" : persistent ? "Conectado" : "Simulação"}</span>
    </header>
    <div className="food-note" role="status">{staging
      ? <><strong>AMBIENTE DE TESTES.</strong> Registros persistem no Supabase de testes. Use somente alimentos e famílias fictícios; nada é publicado na ONG.</>
      : persistent
      ? "Registros conectados ao Supabase. As entregas são vinculadas pelo código de família, sem copiar dados pessoais."
      : <><strong>Dados 100% fictícios.</strong> Cadastros e entregas são simulações e se perdem ao recarregar a página.</>}
    </div>
    <nav className="food-tabs" aria-label="Abas de alimentos">{links.map(link =>
      <Link href={link.href} key={link.href} aria-current={path===link.href ? "page" : undefined}>{link.label}</Link>
    )}</nav>
    {children}
    <footer className="food-footer">
      <span>Os indicadores estimam o consumo; confira as doações, validade dos alimentos e a quantidade real de famílias.</span>
      {!persistent && <button type="button" className="food-link" onClick={resetDemo}>Reiniciar simulação</button>}
    </footer>
  </div>;
}
