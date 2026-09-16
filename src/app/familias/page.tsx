import Link from "next/link";
import { requireTeam } from "@/lib/auth";
import { searchFamilies } from "./actions";
import { FamilyList } from "@/components/family-list";
export default async function Families() {
  const session = await requireTeam();
  const result = session
    ? await searchFamilies({ query: "", status: "", page: 1 })
    : null;
  if (result && !result.ok) throw new Error(result.message);
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">CADASTROS</p>
          <h1>Famílias</h1>
          <p>Cada família, uma história para acompanhar.</p>
        </div>
        {(!session || session.canWrite) && (
          <Link className="button" href="/novo">
            + Novo cadastro
          </Link>
        )}
      </header>
      {result?.ok ? (
        <FamilyList initial={result} />
      ) : (
        <section className="card empty">
          <div className="empty-icon">◎</div>
          <h2>Seu espaço de acolhimento está pronto</h2>
          <p>
            A listagem estará disponível após conectar o banco e configurar os
            acessos da equipe.
          </p>
          <Link className="button" href="/novo">
            Experimentar o cadastro
          </Link>
        </section>
      )}
    </>
  );
}
