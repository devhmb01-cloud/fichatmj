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
  ["/alimentos", "Alimentos", "▥"],
];
export function AppShell({
  children,
  connected = false,
}: {
  children: React.ReactNode;
  connected?: boolean;
}) {
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
            Ficha TMJ<small>GESTÃO DA ONG</small>
          </span>
        </Link>
        <p className="nav-label">NAVEGAÇÃO PRINCIPAL</p>
        <nav aria-label="Navegação principal">
          {links.map(([href, label, icon]) => (
            <Link
              href={href}
              key={href}
              aria-current={
                path === href ||
                (href === "/familias" && path.startsWith("/familias/")) ||
                (href === "/bazar" && path.startsWith("/bazar/")) ||
                (href === "/alimentos" && path.startsWith("/alimentos/"))
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
