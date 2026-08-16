import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { SLUG_VENDAS_SITE } from "./categorias-padrao";

/**
 * Ponte entre a venda e o caixa.
 *
 * O dono pediu para conferir cada venda antes de ela contar, então o pedido pago
 * gera uma sugestão PENDENTE — dinheiro previsto, fora do saldo — e a tela de
 * pendências transforma em CONFIRMADO.
 *
 * Idempotência: a unique (pagamentoId, origem) do Lancamento. O webhook do
 * gateway reenvia a mesma notificação várias vezes e cada reenvio esbarra nela.
 * Pedido manual não tem pagamento no gateway; para esses usamos a chave
 * sintética `order:<id>`, que cumpre o mesmo papel de trava.
 *
 * Roda SEMPRE dentro de um prisma.$transaction (recebe o `tx`), junto com a
 * baixa de estoque: ou a venda inteira acontece, ou nada acontece.
 */

function chaveDoPagamento(pagamentoId: string | null, orderId: string): string {
  return pagamentoId ?? `order:${orderId}`;
}

async function idCategoria(
  tx: Prisma.TransactionClient,
  slug: string,
): Promise<string | null> {
  const c = await tx.categoriaFinanceira.findUnique({
    where: { slug },
    select: { id: true },
  });
  return c?.id ?? null;
}

/** Pedido virou PAGO → entrada pendente de conferência. */
export async function registrarSugestaoDeVenda(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      numero: true,
      total: true,
      cliente: { select: { nome: true } },
      pagamentos: {
        where: { status: "PAGO" },
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!order) return;

  const total = Number(order.total);
  if (!(total > 0)) return; // pedido zerado (brinde, teste) não vira caixa

  const chave = chaveDoPagamento(order.pagamentos[0]?.id ?? null, order.id);
  const categoriaId = await idCategoria(tx, SLUG_VENDAS_SITE);

  // create + catch do P2002 em vez de upsert: se a linha já existe, ela pode ter
  // sido confirmada ou editada pelo dono, e não queremos sobrescrever isso.
  try {
    await tx.lancamento.create({
      data: {
        tipo: "ENTRADA",
        status: "PENDENTE",
        origem: "PEDIDO",
        descricao: `Venda ${order.numero}${order.cliente?.nome ? ` — ${order.cliente.nome}` : ""}`,
        valor: order.total,
        data: new Date(),
        categoriaId,
        orderId: order.id,
        pagamentoId: chave,
      },
    });
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code !== "P2002") throw e;
  }
}

/**
 * Venda desfeita (cancelamento de pedido pago ou estorno no gateway).
 *
 * Se a entrada ainda estava pendente, ela simplesmente sai da fila: nunca contou
 * no caixa. Se já tinha sido confirmada, o dinheiro voltou de verdade para o
 * cliente, então lançamos uma SAÍDA de devolução em vez de apagar a entrada —
 * apagar reescreveria um mês que talvez já esteja fechado, e o extrato do banco
 * mostra as duas pernas.
 */
export async function registrarDevolucaoDeVenda(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const entradas = await tx.lancamento.findMany({
    where: { orderId, origem: "PEDIDO", tipo: "ENTRADA" },
    select: { id: true, status: true, valor: true, pagamentoId: true, categoriaId: true },
  });

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { numero: true },
  });

  for (const entrada of entradas) {
    if (entrada.status === "PENDENTE") {
      await tx.lancamento.update({
        where: { id: entrada.id },
        data: { status: "DESCARTADO" },
      });
      continue;
    }
    if (entrada.status !== "CONFIRMADO") continue;

    try {
      await tx.lancamento.create({
        data: {
          tipo: "SAIDA",
          status: "CONFIRMADO",
          origem: "PEDIDO",
          descricao: `Devolução da venda ${order?.numero ?? ""}`.trim(),
          valor: entrada.valor,
          data: new Date(),
          categoriaId: entrada.categoriaId,
          orderId,
          // Chave própria: a devolução é uma linha distinta da venda, mas também
          // só pode existir uma por venda.
          pagamentoId: `devolucao:${entrada.pagamentoId ?? entrada.id}`,
        },
      });
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      if (code !== "P2002") throw e;
    }
  }
}
