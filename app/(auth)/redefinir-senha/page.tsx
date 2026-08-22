import type { Metadata } from "next";
import RedefinirSenhaClient from "@/components/site/RedefinirSenhaClient";
import { verificarTokenSenha } from "@/actions/recuperar-senha";

export const metadata: Metadata = {
  title: "Criar nova senha | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = typeof token === "string" ? token : "";
  // Confere antes de desenhar o formulário: link vencido não pede senha à toa.
  const checagem = await verificarTokenSenha(t);

  return (
    <RedefinirSenhaClient token={t} valido={checagem.valido} nome={checagem.nome} />
  );
}
