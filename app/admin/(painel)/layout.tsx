import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-semibold text-[#07366A]">
          Guppy de Linhagem — Admin
        </h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            {session.user.name}{" "}
            <span className="text-gray-400">({session.user.role})</span>
          </span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/admin/login" });
            }}
          >
            <button
              type="submit"
              className="text-[#FF035C] hover:underline font-medium"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
