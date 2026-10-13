import "server-only";
import { prisma } from "@/lib/prisma";
import { mensagemRecusa } from "@/lib/payments/mercadopago";
import {
  MetodoPagamento,
  ProviderPagamento,
  type StatusPagamento,
} from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Cartão que o MP responde "em análise" e recusa segundos depois.
 *
 * Cobrança #2026-0074 (12/10): a resposta síncrona foi `pending_review_manual`
 * e a recusa `cc_rejected_high_risk` chegou pelo webhook 3s depois. A tela não
 * mostrava nenhuma das duas coisas: o formulário voltava em branco e o cliente
 * tentou o mesmo cartão de novo. Este módulo é a base para as telas (checkout,
 * link de cobrança e leilão) acompanharem o desfecho real.
 */

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/**
 * Grava a linha Pagamento de um cartão cobrado pelo NOSSO servidor.
 *
 * O webhook pode chegar antes desta gravação (na #2026-0074 chegou 0,3s
 * depois). Se chegou, a linha já existe com o status mais novo: aqui só
 * completamos parcelas, bandeira e o diagnóstico, sem voltar o status para o da
 * resposta síncrona. Antes, nesse caso, nasciam duas linhas e a nossa ficava
 * "em análise" para sempre.
 */
export async function gravarPagamentoCartao(d: {
  orderId: string;
  status: StatusPagamento;
  valor: number;
  externalId: string;
  parcelas: number | null;
  bandeira: string | null;
  /** Só motivo e diagnóstico. NUNCA token/PAN/CVV. */
  payloadRaw: Record<string, unknown>;
}): Promise<void> {
  const existente = await prisma.pagamento.findFirst({
    where: { externalId: d.externalId },
    select: { id: true, payloadRaw: true },
  });
  if (existente) {
    await prisma.pagamento.update({
      where: { id: existente.id },
      data: {
        parcelas: d.parcelas,
        bandeira: d.bandeira,
        // O que o webhook gravou é mais novo e vence.
        payloadRaw: {
          ...d.payloadRaw,
          ...(ehObjeto(existente.payloadRaw) ? existente.payloadRaw : {}),
        } as Prisma.InputJsonValue,
      },
    });
    return;
  }
  await prisma.pagamento.create({
    data: {
      orderId: d.orderId,
      provider: ProviderPagamento.MERCADO_PAGO,
      metodo: MetodoPagamento.CARTAO,
      status: d.status,
      valor: d.valor,
      externalId: d.externalId,
      parcelas: d.parcelas,
      bandeira: d.bandeira,
      payloadRaw: d.payloadRaw as Prisma.InputJsonValue,
    },
  });
}

export type UltimoCartao =
  | { status: "EM_ANALISE" }
  | { status: "RECUSADO"; mensagem: string }
  | null;

/**
 * Como terminou a última tentativa no cartão de um pedido ainda em aberto.
 * `pagamentos` vem do mais novo para o mais velho. O motivo sai do
 * `payloadRaw.statusDetail`, que o webhook atualiza quando a recusa chega
 * depois da análise.
 */
export function ultimoCartao(
  pagamentos: { metodo: string; status: string; payloadRaw?: unknown }[],
): UltimoCartao {
  const p = pagamentos.find((x) => x.metodo === MetodoPagamento.CARTAO);
  if (!p) return null;
  if (p.status === "EM_ANALISE") return { status: "EM_ANALISE" };
  if (p.status !== "RECUSADO") return null;

  const detalhe = ehObjeto(p.payloadRaw)
    ? (p.payloadRaw.statusDetail as string | undefined)
    : undefined;
  const motivo = mensagemRecusa(detalhe);
  return {
    status: "RECUSADO",
    mensagem:
      motivo === mensagemRecusa(null)
        ? "O último pagamento no cartão não foi aprovado e nada foi cobrado. Tente outro cartão ou pague no Pix, que cai na hora."
        : `O último pagamento no cartão não foi aprovado e nada foi cobrado. ${motivo}`,
  };
}
