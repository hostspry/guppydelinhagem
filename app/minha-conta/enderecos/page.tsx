import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { listEnderecos } from "@/lib/queries/minha-conta";
import EnderecosClient from "@/components/conta/EnderecosClient";

export const metadata: Metadata = {
  title: "Meus endereços | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

export default async function EnderecosPage() {
  const session = await auth();
  const enderecos = await listEnderecos(session!.user.id);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-[#07366A]">Meus endereços</h1>
      <EnderecosClient
        enderecos={enderecos.map((e) => ({
          id: e.id,
          cep: e.cep,
          rua: e.rua,
          numero: e.numero,
          complemento: e.complemento,
          bairro: e.bairro,
          cidade: e.cidade,
          estado: e.estado,
          principal: e.principal,
        }))}
      />
    </div>
  );
}
