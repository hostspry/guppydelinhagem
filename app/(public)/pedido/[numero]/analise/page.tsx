import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils/format";
import { whatsappLink, WHATSAPP_DISPLAY } from "@/lib/constants";
import AnaliseStatusPoll from "@/components/checkout/AnaliseStatusPoll";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento em análise — Guppy de Linhagem",
  robots: { index: false, follow: false },
};

const STATUS_PAGO = ["PAGO", "ENVIADO", "ENTREGUE"];

export default async function AnalisePage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { numero: raw } = await params;
  // Rota usa o número sem o "#"; o banco guarda "#2026-0001".
  const numeroLimpo = decodeURIComponent(raw).replace(/^#/, "");
  const numero = `#${numeroLimpo}`;

  const order = await prisma.order.findUnique({
    where: { numero },
    select: {
      numero: true,
      status: true,
      total: true,
      parcelas: true,
      items: {
        select: {
          id: true,
          nomeProduto: true,
          quantidade: true,
          precoUnitario: true,
        },
      },
    },
  });

  if (!order) notFound();

  // Se o webhook já confirmou enquanto isso, manda direto pro sucesso.
  if (STATUS_PAGO.includes(order.status)) {
    redirect(`/pedido/${numeroLimpo}/sucesso`);
  }

  const total = Number(order.total);

  return (
    <div className="container-site py-12 max-w-lg mx-auto">
      {/* Poll: quando o webhook aprovar, avança pro sucesso. */}
      <AnaliseStatusPoll numero={order.numero} />

      <div className="text-center space-y-3">
        <Hourglass
          className="mx-auto w-14 h-14 text-amber-500"
          aria-hidden="true"
        />
        <h1 className="text-primary text-2xl font-semibold">
          Pagamento em análise
        </h1>
        <p className="text-sm text-muted-foreground">
          O pagamento do pedido{" "}
          <strong className="text-primary">{order.numero}</strong> está sendo
          analisado pelo emissor do cartão. A confirmação costuma chegar em
          alguns minutos — você não precisa pagar de novo.
        </p>
      </div>

      {/* Resumo */}
      <div className="mt-8 bg-white border border-border rounded-xl p-5 space-y-4">
        <h2 className="text-primary font-semibold">Resumo do pedido</h2>
        <ul className="divide-y divide-border text-sm">
          {order.items.map((it) => (
            <li key={it.id} className="py-2 flex justify-between gap-3">
              <span className="text-primary">
                {it.nomeProduto}
                <span className="text-muted-foreground"> ×{it.quantidade}</span>
              </span>
              <span className="text-primary font-medium shrink-0 tabular-nums">
                {formatBRL(Number(it.precoUnitario) * it.quantidade)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-3 flex items-end justify-between text-sm">
          <span className="font-medium text-primary">
            Total{order.parcelas && order.parcelas > 1 ? ` (${order.parcelas}x)` : ""}
          </span>
          <span className="text-primary text-2xl font-bold tabular-nums">
            {formatBRL(total)}
          </span>
        </div>
      </div>

      <div className="mt-4 text-sm text-muted-foreground bg-bg-alt rounded-xl p-4 leading-relaxed">
        <p>
          Assim que o pagamento for aprovado, esta página avança sozinha para a
          confirmação. Você também recebe a confirmação por e-mail. Qualquer
          dúvida, fale com a gente.
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href={whatsappLink(
            `Olá! Fiz o pedido ${order.numero} e o pagamento ficou em análise. Pode me ajudar?`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-green-600 text-white text-sm font-semibold px-6 py-3 rounded-pill hover:brightness-110 transition-all"
        >
          <WhatsAppIcon className="w-4 h-4" />
          Falar no WhatsApp ({WHATSAPP_DISPLAY})
        </a>
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
