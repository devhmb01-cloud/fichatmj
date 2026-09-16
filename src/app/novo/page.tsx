import { FamilyForm } from "@/components/family-form";
import { requireTeam } from "@/lib/auth";
import { registerFamily } from "./actions";
export default async function NewFamily() {
  const session = await requireTeam(true);
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">ACOLHIMENTO</p>
          <h1>Novo cadastro</h1>
          <p>Preencha as informações da família, uma etapa de cada vez.</p>
        </div>
      </header>
      <FamilyForm saveAction={session ? registerFamily : undefined} />
    </>
  );
}
