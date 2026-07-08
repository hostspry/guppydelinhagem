import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getDadosPerfil } from "@/lib/queries/minha-conta";
import { formatTelefone, formatCpfCnpj } from "@/lib/utils/format";
import PerfilForm from "@/components/conta/PerfilForm";

export const metadata: Metadata = {
  title: "Meu perfil | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

export default async function PerfilPage() {
  const session = await auth();
  const user = session!.user;
  const perfil = await getDadosPerfil(user.id, user.email);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-[#07366A]">Meu perfil</h1>
      <div className="rounded-2xl bg-white border border-black/5 p-6 shadow-sm">
        <PerfilForm
          inicial={{
            nome: perfil.nome,
            email: perfil.email,
            telefone: perfil.telefone ? formatTelefone(perfil.telefone) : "",
            cpfCnpj: perfil.cpfCnpj ? formatCpfCnpj(perfil.cpfCnpj) : "",
          }}
        />
      </div>
    </div>
  );
}
