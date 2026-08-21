import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { vincularClientesAoUsuario } from "@/lib/queries/minha-conta";
import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import PainelNav from "@/components/conta/PainelNav";

// Layout do painel do cliente: guarda de sessão + auto-link Cliente.userId + a
// mesma Navbar/Footer públicos. As páginas filhas só renderizam o conteúdo.
export default async function MinhaContaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/minha-conta");

  // Senha temporária (acesso criado pela loja numa venda direta): o cliente
  // define a dele ANTES de ver o painel. A página fica fora deste layout, senão
  // o redirect entraria em laço.
  if (session.user.senhaPrecisaTroca) redirect("/definir-senha");

  // Idempotente e barato — liga os Clientes deste e-mail ao usuário logado.
  await vincularClientesAoUsuario(session.user.id, session.user.email);

  return (
    <>
      <Navbar />
      <main className="bg-gray-50">
        <div className="container-site py-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
          <PainelNav
            nome={session.user.name}
            email={session.user.email}
            image={session.user.image}
          />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
