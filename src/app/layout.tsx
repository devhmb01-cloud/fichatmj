import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
