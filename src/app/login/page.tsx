import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getTeamSession } from "@/lib/auth";
export default async function Login() {
  const session = await getTeamSession();
  if (session.mode === "connected") redirect("/");
  return (
    <>
      <header>
        <div>
          <p className="eyebrow">ESPAÇO DA EQUIPE</p>
          <h1>Bem-vindo ao Ficha TMJ</h1>
          <p>Entre para acompanhar as famílias com segurança.</p>
        </div>
      </header>
      {session.mode === "demo" ? (
        <section className="card">
          <h2>Acesso ainda não configurado</h2>
          <p>
            Enquanto o Supabase é configurado, você pode conhecer o formulário
            com dados fictícios.
          </p>
          <Link className="button" href="/">
            Abrir demonstração
          </Link>
        </section>
      ) : (
        <LoginForm />
      )}
    </>
  );
}
