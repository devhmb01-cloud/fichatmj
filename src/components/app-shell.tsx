"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
const links = [
  ["/", "Dashboard", "◈"],
  ["/familias", "Famílias", "◎"],
  ["/novo", "Novo cadastro", "＋"],
  ["/relatorios", "Relatórios", "▤"],
  ["/bazar", "Bazar", "▣"],
];
export function AppShell({
  children,
  connected = false,
}: {
  children: React.ReactNode;
  connected?: boolean;
}) {
  const path = usePathname();
  const isBazar = path === "/bazar" || path.startsWith("/bazar/");
  const visibleLinks = isBazar
    ? links.filter(([href]) => href === "/" || href === "/bazar")
    : links;
  return (
    <div className="shell">
      <a className="skip" href="#conteudo">
        Pular para conteúdo
      </a>
      <aside>
        <Link className="brand" href="/">
          <b>tmj</b>
          <span>
            Ficha TMJ<small>{isBazar ? "GESTÃO COMERCIAL" : "GESTÃO DE FAMÍLIAS"}</small>
          </span>
        </Link>
        <p className="nav-label">{isBazar ? "GESTÃO DO BAZAR" : "ESPAÇO DE ACOLHIMENTO"}</p>
        <nav aria-label="Navegação principal">
          {visibleLinks.map(([href, label, icon]) => (
            <Link
              href={href}
              key={href}
              aria-current={
                path === href ||
                (href === "/familias" && path.startsWith("/familias/")) ||
                (href === "/bazar" && path.startsWith("/bazar/"))
                  ? "page"
                  : undefined
              }
            >
              <span aria-hidden>{icon}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="aside-bottom">
          ● {connected ? "Espaço da equipe" : "Demonstração"}
          <small>Mais organização. Mais cuidado.</small>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <span>Juntos, acompanhamos melhor.</span>
          <span className="badge">
            {connected ? "ACESSO RESTRITO" : "PRÉVIA LOCAL"}
          </span>
          {connected && path !== "/login" && (
            <form action={signOut}>
              <button className="button secondary">Sair</button>
            </form>
          )}
        </div>
        <main id="conteudo">
          {!connected && (
            <div className="notice">
              Demonstração · Use apenas dados fictícios. O formulário não salva
              informações.
            </div>
          )}
          {children}
        </main>
        <footer>Ficha TMJ · Construindo uma rede de cuidado</footer>
      </div>
    </div>
  );
}
