import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/utils/format";
import {
  whatsappLink,
  WHATSAPP_DISPLAY,
} from "@/lib/constants";
import LimparCarrinho from "@/components/checkout/LimparCarrinho";
import PurchaseTracker from "@/components/checkout/PurchaseTracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pedido confirmado · Guppy de Linhagem",
  robots: { index: false, follow: false },
};

const STATUS_PAGO = ["PAGO", "ENVIADO", "ENTREGUE"];

export default async function SucessoPage({
  params,
  searchParams,
}: {
  params: Promise<{ numero: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { numero: raw } = await params;
  const { t } = await searchParams;
  // Rota usa o número sem o "#"; o banco guarda "#2026-0001".
  const numero = `#${decodeURIComponent(raw).replace(/^#/, "")}`;

  const order = await prisma.order.findUnique({
    where: { numero },
    select: {
      numero: true,
      status: true,
      total: true,
      frete: true,
      transportadora: true,
      publicToken: true,
      items: {
        select: {
          id: true,
          productId: true,
          nomeProduto: true,
          quantidade: true,
          precoUnitario: true,
        },
      },
    },
  });

  if (!order) notFound();

  /**
   * O número do pedido é sequencial, então qualquer um chuta #2026-0011 e cai
   * aqui. Sem o token do link, a página mostra só o ANDAMENTO — nada de itens
   * nem valores, que juntos revelariam a operação inteira da loja a quem
   * percorresse a sequência.
   *
   * Pedido antigo (sem token gravado) segue aberto: quebrar um link que já foi
   * mandado ao cliente seria pior do que o risco que resta neles.
   */
  const donoDoLink = !order.publicToken || order.publicToken === (t ?? "");

  const pago = STATUS_PAGO.includes(order.status);
  const total = Number(order.total);
  const frete = Number(order.frete);

  // Itens p/ o GA4 purchase (sem dado pessoal — só id de produto, valor, qtd).
  const gaItems = order.items.map((it) => ({
    item_id: it.productId ?? it.id,
    item_name: it.nomeProduto,
    price: Number(it.precoUnitario),
    quantity: it.quantidade,
  }));

  return (
    <div className="container-site py-12 max-w-lg mx-auto">
      {/* Pagamento confirmado → limpa o carrinho + dispara purchase (dedup). */}
      {pago && <LimparCarrinho />}
      {pago && (
        <PurchaseTracker
          numero={order.numero}
          value={total}
          shipping={frete}
          items={gaItems}
        />
      )}

      <div className="text-center space-y-3">
        {pago ? (
          <>
            <CheckCircle2
              className="mx-auto w-14 h-14 text-green-600"
              aria-hidden="true"
            />
            <h1 className="text-primary text-2xl font-semibold">
              Pagamento confirmado!
            </h1>
            <p className="text-sm text-muted-foreground">
              Recebemos o pagamento do pedido{" "}
              <strong className="text-primary">{order.numero}</strong>. Obrigado
              pela compra!
            </p>
          </>
        ) : (
          <>
            <Clock
              className="mx-auto w-14 h-14 text-amber-500"
              aria-hidden="true"
            />
            <h1 className="text-primary text-2xl font-semibold">
              Estamos confirmando seu pagamento
            </h1>
            <p className="text-sm text-muted-foreground">
              O pedido <strong className="text-primary">{order.numero}</strong>{" "}
              ainda não teve o pagamento confirmado. Se você acabou de pagar,
              aguarde alguns instantes.
            </p>
          </>
        )}
      </div>

      {/* Resumo do pedido — só para quem chegou pelo link completo. */}
      {donoDoLink ? (
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
          <div className="border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Frete</span>
              <span className="tabular-nums">{formatBRL(frete)}</span>
            </div>
            <div className="flex items-end justify-between pt-1">
              <span className="text-sm font-medium text-primary">
                Total {pago ? "pago" : ""}
              </span>
              <span className="text-green-600 text-2xl font-bold tabular-nums">
                {formatBRL(total)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 bg-white border border-border rounded-xl p-5 text-sm text-muted-foreground">
          <p>
            Para ver os itens e o valor deste pedido, abra o link que você
            recebeu ao finalizar a compra, ou entre em{" "}
            <Link href="/minha-conta/pedidos" className="text-secondary underline">
              Minha conta
            </Link>
            .
          </p>
        </div>
      )}

      {/* Envio — prazo honesto (sem inventar data fixa) */}
      <div className="mt-4 text-sm text-muted-foreground bg-bg-alt rounded-xl p-4 leading-relaxed">
        <p>
          A gente prepara seu pedido com cuidado para o transporte de peixes
          vivos. Quando despacharmos, você recebe o código de rastreio no
          WhatsApp ou e-mail. Antes disso, combinamos a melhor data de envio
          para os peixes chegarem bem.
        </p>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href={whatsappLink(
            `Olá! Acabei de fazer o pedido ${order.numero} e gostaria de combinar o envio.`,
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
