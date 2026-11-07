"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBazarDemo } from "@/components/bazar/bazar-demo-context";
import type { ReactNode } from "react";

const links = [
  { href: "/bazar", label: "Painel" },
  { href: "/bazar/estoque", label: "Estoque" },
  { href: "/bazar/vendas", label: "Vendas" },
];

export function BazarShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { resetDemo, persistent } = useBazarDemo();
  return (
    <div className="bazar-page">
      <div className="bazar-top">
        <div>
          <p className="bazar-eyebrow">Ficha TMJ / Gestão comercial</p>
          <h1>Bazar</h1>
        </div>
        <span className="bazar-pill">{persistent ? "Conectado" : "Simulação"}</span>
      </div>
      <div className="bazar-warning" role="status">
        {persistent
          ? "Estoque e vendas são registrados no Supabase. Confira as quantidades antes de confirmar."
          : <><strong>Somente demonstração.</strong> Todos os números são fictícios. Nada é enviado ao Supabase ou salvo após recarregar a página.</>}
      </div>
      <nav className="bazar-tabs" aria-label="Navegação do bazar">
        {links.map(link => (
          <Link key={link.href} href={link.href}
            aria-current={path === link.href ? "page" : undefined}>{link.label}</Link>
        ))}
      </nav>
      {children}
      <div className="bazar-demo-footer">
        <span>{persistent
          ? "Registre apenas a quantidade e o preço das roupas. Não cadastre dados pessoais aqui."
          : "Não utilize dados reais nesta versão."}</span>
        {!persistent && <button type="button" className="bazar-link-button" onClick={resetDemo}>
          Restaurar números fictícios
        </button>}
      </div>
    </div>
  );
}
