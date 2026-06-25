import type { Metadata } from "next";
import Link from "next/link";
import { XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento não concluído · Guppy de Linhagem",
  robots: { index: false, follow: false },
};

// Back_url de FALHA do Checkout Pro. É só navegação — o pedido segue
// AGUARDANDO_PAGAMENTO (nada é marcado aqui; quem confirma é o webhook). O
// carrinho do cliente continua salvo, então ele pode tentar outro método.
export default async function FalhaPagamentoPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero: raw } = await params;
  const numero = `#${decodeURIComponent(raw).replace(/^#/, "")}`;

  return (
    <div className="container-site py-16 max-w-lg mx-auto text-center space-y-4">
      <XCircle className="mx-auto w-14 h-14 text-secondary" aria-hidden="true" />
      <h1 className="text-primary text-2xl font-semibold">
        Pagamento não concluído
      </h1>
      <p className="text-sm text-muted-foreground">
        O pagamento do pedido <strong className="text-primary">{numero}</strong>{" "}
        não foi concluído. Nada foi cobrado. Você pode tentar outro método —
        Pix, cartão ou o próprio Mercado Pago.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <Link
          href="/checkout"
          className="inline-flex items-center justify-center bg-secondary text-white text-sm font-semibold px-6 py-3 rounded-pill hover:brightness-110 transition-all"
        >
          Tentar de novo
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center text-sm text-primary font-medium px-6 py-3 rounded-pill border border-border hover:border-primary transition-all"
        >
          Voltar à loja
        </Link>
      </div>
    </div>
  );
}
