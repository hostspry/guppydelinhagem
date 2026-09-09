import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { registrarSugestaoDeVenda } from "@/lib/financeiro/venda-no-caixa";

// Baixa de estoque (pool machos/fêmeas) compartilhada entre os DOIS caminhos que
// confirmam pagamento: o admin (actions/pedidos.ts → atualizarStatusPedido) e o
// webhook do Mercado Pago. Mesma lógica, mesma trava `Order.estoqueBaixado` —
// uma venda baixa o estoque UMA vez, não importa por onde foi confirmada.
//
// server-only: nunca pode ser importado por Client Component (vaza acesso a
// banco). É chamado SEMPRE dentro de um prisma.$transaction (recebe o `tx`).

/**
 * Ajusta o estoque dos produtos de cada item do pedido.
 * `sinal = -1` baixa (venda confirmada); `+1` estorna (cancelamento de pedido já
 * baixado). Permite estoque negativo — a regra do projeto é NÃO bloquear venda
 * por estoque (o admin sinaliza).
 *
 * Dois estoques diferentes, porque são dois negócios na mesma tabela:
 *
 *   PEIXE tem pool de machos/fêmeas e uma receita por composição (trio consome
 *   1 macho e 2 fêmeas). `Product.estoque` é só o espelho da soma.
 *
 *   O resto (criadeira, ração, acessório) tem uma unidade só, em
 *   `Product.estoque`. Ficava de fora daqui: a venda no site nunca baixava, e o
 *   número só mudava quando alguém editava o produto à mão. Passa a baixar
 *   junto — sem isso, sincronizar estoque com marketplace seria sincronizar um
 *   número que não quer dizer nada.
 */
export async function ajustarPoolEstoque(
  tx: Prisma.TransactionClient,
  orderId: string,
  sinal: 1 | -1,
): Promise<void> {
  const itens = await tx.orderItem.findMany({
    where: { orderId, productId: { not: null } },
    select: {
      productId: true,
      composicao: true,
      qtdMachos: true,
      qtdFemeas: true,
      quantidade: true,
    },
  });
  for (const it of itens) {
    if (it.productId == null) continue;
    const prod = await tx.product.findUnique({
      where: { id: it.productId },
      select: { tipo: true, estoque: true, estoqueMachos: true, estoqueFemeas: true },
    });
    if (!prod) continue;

    // Receita de peixe: mexe no pool e o espelho vira a soma.
    if (it.composicao != null && it.qtdMachos != null && it.qtdFemeas != null) {
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
      continue;
    }

    // Produto de unidade. PEIXE sem receita fica de fora: mexer no espelho sem
    // mexer no pool deixaria os dois números brigando, e o pool é a verdade.
    if (prod.tipo === "PEIXE") continue;
    await tx.product.update({
      where: { id: it.productId },
      data: { estoque: prod.estoque + sinal * it.quantidade },
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
    select: { status: true, estoqueBaixado: true },
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
    // Contabiliza o uso de CADA cupom distinto usado nos itens (campanhas + código
    // secreto), uma vez cada, na mesma trava do estoque (idempotente: webhook
    // reenviado não reconta). Pedido sem cupom → no-op.
    const itensComCupom = await tx.orderItem.findMany({
      where: { orderId, cupomId: { not: null } },
      select: { cupomId: true },
    });
    const cupomIds = [
      ...new Set(
        itensComCupom
          .map((i) => i.cupomId)
          .filter((id): id is string => id != null),
      ),
    ];
    for (const id of cupomIds) {
      await tx.cupomDesconto.update({
        where: { id },
        data: { usosRealizados: { increment: 1 } },
      });
    }
    await tx.order.update({
      where: { id: orderId },
      data: { estoqueBaixado: true },
    });
    baixou = true;

    // Mesma trava do estoque: a venda entra no caixa (como sugestão a conferir)
    // uma vez só, não importa se veio do admin ou do webhook.
    await registrarSugestaoDeVenda(tx, orderId);
  }

  return { pago: true, baixou };
}
