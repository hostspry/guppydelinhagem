import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { tokenDescadastroConfere } from "@/lib/campanhas";

export const metadata: Metadata = {
  title: "Descadastrar | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Saída da lista de promoções, pelo link do rodapé do e-mail.
 *
 * Um clique resolve: pedir login aqui seria empurrar a pessoa para marcar o
 * e-mail como spam, que é muito pior para o domínio do que perder um contato.
 * O token no link é derivado do e-mail, então ninguém descadastra terceiro.
 */
export default async function DescadastrarPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e, t } = await searchParams;
  const email = (e ?? "").trim().toLowerCase();
  const valido = !!email && tokenDescadastroConfere(email, t ?? "");

  if (valido) {
    // updateMany: o mesmo e-mail pode estar em mais de um cadastro.
    await prisma.cliente
      .updateMany({ where: { email }, data: { aceitaEmails: false } })
      .catch(() => {});
  }

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white border border-border rounded-xl p-6 text-center space-y-3">
        {valido ? (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" aria-hidden="true" />
            <h1 className="text-xl font-bold text-primary">Pronto, você saiu</h1>
            <p className="text-sm text-muted-foreground">
              O e-mail <strong>{email}</strong> não recebe mais nossas promoções.
              Avisos sobre pedidos que você fizer continuam chegando.
            </p>
          </>
        ) : (
          <>
            <XCircle className="w-10 h-10 text-secondary mx-auto" aria-hidden="true" />
            <h1 className="text-xl font-bold text-primary">Link inválido</h1>
            <p className="text-sm text-muted-foreground">
              Use o link que está no rodapé do e-mail que você recebeu. Se
              continuar sem funcionar, é só responder aquele e-mail pedindo para
              sair da lista.
            </p>
          </>
        )}
        <Link href="/" className="inline-block text-sm text-secondary hover:underline pt-2">
          Voltar para a loja
        </Link>
      </div>
    </main>
  );
}
