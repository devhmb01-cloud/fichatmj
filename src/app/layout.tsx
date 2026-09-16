import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import { getSupabaseConfig } from "@/lib/supabase/config";
// Never share rendered pages between sessions, including after configuration changes.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ficha TMJ | Gestão de famílias",
  description: "Cadastro e acompanhamento familiar",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppShell connected={Boolean(getSupabaseConfig())}>{children}</AppShell>
      </body>
    </html>
  );
}
