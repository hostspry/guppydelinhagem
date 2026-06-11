import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Defense in depth — middleware já protege, mas validamos de novo
  if (!session?.user) redirect("/admin/login");
  if (session.user.role === "CUSTOMER") redirect("/admin/login");

  // Force password change — UI da troca vem em sub-fase futura
  if (session.user.senhaPrecisaTroca) {
    console.warn(
      `Usuário ${session.user.email} precisa trocar a senha temporária.`,
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar desktop (sticky, full height) */}
      <div className="hidden md:flex md:sticky md:top-0 md:h-screen">
        <AdminSidebar />
      </div>

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          userName={session.user.name ?? "Admin"}
          userRole={session.user.role}
          breadcrumb="Início"
        />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
