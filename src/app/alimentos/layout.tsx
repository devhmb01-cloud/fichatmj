import { requireTeam } from "@/lib/auth";
import { getFoodState } from "@/app/alimentos/actions";
import { FoodProvider } from "@/components/alimentos/food-context";
import { FoodShell } from "@/components/alimentos/food-shell";
import "./alimentos.css";

export default async function AlimentosLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Never render beneficiary-linked records to unauthorized viewers.
  const session = await requireTeam(true);
  const enabled = process.env.FOOD_PERSISTENCE_ENABLED === "true";
  const persistent = enabled && !!session && session.mode === "connected";
  if (enabled && !persistent) throw new Error("Alimentos exige um Supabase configurado e acesso staff/admin.");
  const initialState = persistent ? await getFoodState() : undefined;
  return (
    <FoodProvider persistent={persistent} initialState={initialState}>
      <FoodShell>{children}</FoodShell>
    </FoodProvider>
  );
}
