import { requireTeam } from "@/lib/auth";
import { BazarDemoProvider } from "@/components/bazar/bazar-demo-context";
import { BazarShell } from "@/components/bazar/bazar-shell";
import "./bazar.css";

export default async function BazarLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // O modo conectado exige autenticação; o modo local do projeto permite prévia fictícia.
  await requireTeam();
  return (
    <BazarDemoProvider>
      <BazarShell>{children}</BazarShell>
    </BazarDemoProvider>
  );
}
