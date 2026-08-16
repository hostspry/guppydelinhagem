import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { membroAtual } from "@/lib/permissoes-server";
import {
  PAPEL_LABEL,
  PERMISSOES_POR_PAPEL,
  SemPermissaoError,
} from "@/lib/permissoes";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth — o middleware já barra quem não é da equipe, mas aqui a
  // fonte é o banco: quem foi removido do time cai fora no próximo clique, sem
  // esperar o JWT de 1 dia expirar.
  let membro;
  try {
    membro = await membroAtual();
  } catch (e) {
    // Não manda direto para /admin/login: com o JWT antigo ainda dizendo "admin",
    // o middleware devolveria para cá em laço. A rota abaixo apaga o cookie.
    if (e instanceof SemPermissaoError) redirect("/api/sessao-encerrada");
    throw e;
  }

  // Senha temporária tem que virar senha de verdade antes de mexer na loja.
  // A página da troca fica fora deste layout, senão o redirect entra em laço.
  if (membro.senhaPrecisaTroca) redirect("/admin/trocar-senha");

  const permissoes = PERMISSOES_POR_PAPEL[membro.role];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar desktop (sticky, full height) */}
      <div className="hidden md:flex md:sticky md:top-0 md:h-screen">
        <AdminSidebar permissoes={permissoes} />
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          userName={membro.nome}
          userRole={PAPEL_LABEL[membro.role]}
          breadcrumb="Início"
          permissoes={permissoes}
        />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
