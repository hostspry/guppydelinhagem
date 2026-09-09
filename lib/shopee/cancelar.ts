import "server-only";
import { prisma } from "@/lib/prisma";
import { ajustarPoolEstoque } from "@/lib/pedido-baixa";

/**
 * Cancela um pedido que foi importado da Shopee e depois cancelado lá.
 *
 * Devolve o estoque na mesma transação, com a trava `estoqueBaixado`: sem isso,
 * um cancelamento avisado duas vezes (webhook + varredura) devolveria a mesma
 * peça duas vezes, e o site passaria a oferecer o que não existe.
 *
 * Separado de lib/shopee/pedidos para o import ser sob demanda: o módulo de
 * pedidos é grande e só precisa disto no caso raro do cancelamento.
 */
export async function cancelarPedidoImportado(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const atual = await tx.order.findUnique({
      where: { id: orderId },
      select: { status: true, estoqueBaixado: true },
    });
    if (!atual || atual.status === "CANCELADO") return;

    if (atual.estoqueBaixado) {
      await ajustarPoolEstoque(tx, orderId, 1);
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELADO", estoqueBaixado: false },
    });
  });
}
