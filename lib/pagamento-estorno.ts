import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { StatusPagamento } from "@/lib/generated/prisma/enums";
import { ajustarPoolEstoque } from "@/lib/pedido-baixa";

// Rotina ÚNICA de estorno compartilhada pela action do admin e pelo webhook do MP
// (estorno feito pelo painel). É DINHEIRO: idempotência é o requisito nº 1 — nada
// pode estornar/devolver estoque duas vezes. Roda SEMPRE dentro de prisma.$transaction.
//
// Trava dupla, ambas atômicas no banco:
//  1. estornadoEm do Pagamento (updateMany WHERE estornadoEm IS NULL) — só o
//     primeiro a "fechar" prossegue; numa corrida (botão × webhook) o segundo
//     bloqueia no row lock e sai com count 0.
//  2. Order.estoqueBaixado (updateMany WHERE estoqueBaixado = true) — reverte o
//     pool UMA vez. Se o pedido já foi cancelado antes (estoque já revertido pela
//     action de status), estoqueBaixado é false → não reverte de novo.

/**
 * Marca o pagamento como estornado, muda o pedido para CANCELADO e devolve os
 * peixes ao pool — tudo idempotente. Retorna { aplicado: false } se já estava
 * estornado (não faz nada). NÃO chama o gateway: o refund no MP é responsabilidade
 * do chamador (action) ou já aconteceu (webhook).
 */
export async function aplicarEstornoPedido(
  tx: Prisma.TransactionClient,
  args: { orderId: string; pagamentoId: string; refundId: string | null },
): Promise<{ aplicado: boolean }> {
  const trava = await tx.pagamento.updateMany({
    where: { id: args.pagamentoId, estornadoEm: null },
    data: {
      estornadoEm: new Date(),
      refundId: args.refundId,
      status: StatusPagamento.ESTORNADO,
    },
  });
  if (trava.count === 0) return { aplicado: false }; // já estornado

  // Reverte o estoque só se ainda estava baixado (trava atômica → uma vez só).
  const reverteu = await tx.order.updateMany({
    where: { id: args.orderId, estoqueBaixado: true },
    data: { estoqueBaixado: false },
  });
  if (reverteu.count > 0) {
    await ajustarPoolEstoque(tx, args.orderId, 1); // devolve machos/fêmeas ao pool
  }

  await tx.order.update({
    where: { id: args.orderId },
    data: { status: "CANCELADO" },
  });

  return { aplicado: true };
}
