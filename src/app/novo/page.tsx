import { FamilyForm } from "@/components/family-form";
export default function NewFamily() {
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">ACOLHIMENTO</p>
          <h1>Novo cadastro</h1>
          <p>Preencha as informações da família, uma etapa de cada vez.</p>
        </div>
      </header>
      <FamilyForm />
    </>
  );
}
