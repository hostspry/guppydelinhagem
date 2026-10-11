import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CobrancaArremate from "@/components/leilao/CobrancaArremate";
import { getArrematePorToken } from "@/lib/queries/leiloes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento do leilão · Guppy de Linhagem",
  robots: { index: false, follow: false }, // link privado, não indexa
};

/**
 * Link da cobrança do leilão. Não pede login: o token de 128 bits é a chave,
 * igual ao link de cobrança avulsa. Quem tem conta vê a mesma tela em
 * /minha-conta/leiloes.
 */
export default async function LeilaoCobrancaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();
  const a = await getArrematePorToken(token);
  if (!a) notFound();

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <CobrancaArremate token={token} a={a} />
    </div>
  );
}
