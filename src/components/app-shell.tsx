"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [
  ["/", "Dashboard", "◈"],
  ["/familias", "Famílias", "◎"],
  ["/novo", "Novo cadastro", "＋"],
  ["/relatorios", "Relatórios", "▤"],
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="shell">
      <a className="skip" href="#conteudo">
        Pular para conteúdo
      </a>
      <aside>
        <Link className="brand" href="/">
          <b>tmj</b>
          <span>
            Ficha TMJ<small>GESTÃO DE FAMÍLIAS</small>
          </span>
        </Link>
        <p className="nav-label">ESPAÇO DE ACOLHIMENTO</p>
        <nav aria-label="Navegação principal">
          {links.map(([href, label, icon]) => (
            <Link
              href={href}
              key={href}
              aria-current={path === href ? "page" : undefined}
            >
              <span aria-hidden>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="aside-bottom">
          ● Base inicial<small>Mais organização. Mais cuidado.</small>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <span>Juntos, acompanhamos melhor.</span>
          <span className="badge">PRÉVIA LOCAL</span>
        </div>
        <main id="conteudo">
          <div className="notice">
            Demonstração · Use apenas dados fictícios. O formulário não salva
            informações.
          </div>
          {children}
        </main>
        <footer>Ficha TMJ · Construindo uma rede de cuidado</footer>
      </div>
    </div>
  );
}
