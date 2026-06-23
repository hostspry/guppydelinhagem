import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";

// Baixa de estoque (pool machos/fêmeas) compartilhada entre os DOIS caminhos que
// confirmam pagamento: o admin (actions/pedidos.ts → atualizarStatusPedido) e o
// webhook do Mercado Pago. Mesma lógica, mesma trava `Order.estoqueBaixado` —
// uma venda baixa o estoque UMA vez, não importa por onde foi confirmada.
//
// server-only: nunca pode ser importado por Client Component (vaza acesso a
// banco). É chamado SEMPRE dentro de um prisma.$transaction (recebe o `tx`).

/**
 * Ajusta o pool de machos/fêmeas dos produtos de cada item do pedido.
 * `sinal = -1` baixa (venda confirmada); `+1` estorna (cancelamento de pedido já
 * baixado). Re-sincroniza o espelho `Product.estoque`. Permite pool negativo —
 * a regra do projeto é NÃO bloquear venda por estoque (o admin sinaliza).
 */
export async function ajustarPoolEstoque(
  tx: Prisma.TransactionClient,
  orderId: string,
  sinal: 1 | -1,
): Promise<void> {
  const itens = await tx.orderItem.findMany({
    where: { orderId, productId: { not: null }, composicao: { not: null } },
    select: {
      productId: true,
      qtdMachos: true,
      qtdFemeas: true,
      quantidade: true,
    },
  });
  for (const it of itens) {
    if (it.productId == null || it.qtdMachos == null || it.qtdFemeas == null) {
      continue;
    }
    const prod = await tx.product.findUnique({
      where: { id: it.productId },
      select: { estoqueMachos: true, estoqueFemeas: true },
    });
    if (!prod) continue;
    const machos = prod.estoqueMachos + sinal * it.qtdMachos * it.quantidade;
    const femeas = prod.estoqueFemeas + sinal * it.qtdFemeas * it.quantidade;
    await tx.product.update({
      where: { id: it.productId },
      data: {
        estoqueMachos: machos,
        estoqueFemeas: femeas,
        estoque: machos + femeas, // re-sincroniza o espelho
      },
    });
  }
}

/**
 * Transição → PAGO + baixa do pool, com a trava `estoqueBaixado` (baixa UMA vez).
 * Idempotente e reentrante: pode ser chamada várias vezes (o webhook do MP
 * reenvia) sem baixar duas vezes.
 *
 * Só confirma a partir de `AGUARDANDO_PAGAMENTO` (ou reentrância em quem já está
 * `PAGO`). Pedido `RASCUNHO`/`CANCELADO`/`ENVIADO`/`ENTREGUE` NÃO é "pago" por
 * aqui — um webhook atrasado não ressuscita pedido cancelado nem reabre pedido
 * já enviado. Retorna `{ pago, baixou }` (baixou = se baixou o estoque agora).
 *
 * DEVE rodar dentro de um prisma.$transaction (recebe o `tx`).
 */
export async function transicionarParaPago(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<{ pago: boolean; baixou: boolean }> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true, estoqueBaixado: true, cupomId: true },
  });
  if (!order) throw new Error("Pedido não encontrado.");

  // Confirma só quando aguardando pagamento; já-PAGO é no-op idempotente.
  if (order.status !== "AGUARDANDO_PAGAMENTO" && order.status !== "PAGO") {
    return { pago: false, baixou: false };
  }

  if (order.status !== "PAGO") {
    await tx.order.update({ where: { id: orderId }, data: { status: "PAGO" } });
  }

  let baixou = false;
  if (!order.estoqueBaixado) {
    await ajustarPoolEstoque(tx, orderId, -1);
    // Contabiliza o uso do cupom UMA vez, na mesma trava do estoque (idempotente:
    // um webhook reenviado não conta de novo). Pedido sem cupom → no-op.
    if (order.cupomId) {
      await tx.cupomDesconto.update({
        where: { id: order.cupomId },
        data: { usosRealizados: { increment: 1 } },
      });
    }
    await tx.order.update({
      where: { id: orderId },
      data: { estoqueBaixado: true },
    });
    baixou = true;
  }

  return { pago: true, baixou };
}
