import { requireTeam } from "@/lib/auth";
import { getBazarState } from "@/app/bazar/actions";
import { BazarDemoProvider } from "@/components/bazar/bazar-demo-context";
import { BazarShell } from "@/components/bazar/bazar-shell";
import "./bazar.css";

export default async function BazarLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireTeam();
  const enabled = process.env.BAZAR_PERSISTENCE_ENABLED === "true";
  // No silent fallback to demo after enabling: incomplete migrations should fail visibly.
  const persistent = enabled && !!session && session.mode === "connected";
  if (enabled && !persistent) {
    throw new Error("A persistência do Bazar exige um Supabase conectado e uma conta autorizada.");
  }
  const initialState = persistent ? await getBazarState() : undefined;
  return (
    <BazarDemoProvider persistent={persistent} initialState={initialState}>
      <BazarShell>{children}</BazarShell>
    </BazarDemoProvider>
  );
}
