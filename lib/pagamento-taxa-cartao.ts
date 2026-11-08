import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ITEM_TAXA_CARTAO } from "@/lib/taxa-cartao";

/**
 * Cartão aprovado num link de cobrança ou de leilão: a taxa do cartão que o
 * cliente pagou vira uma linha do pedido, e o total passa a ser o que entrou.
 * Sem isto, o caixa registraria o valor do Pix (o total do pedido) e a taxa que o
 * Mercado Pago desconta deixaria a loja curta: era exatamente o que a regra quer
 * evitar.
 *
 * A taxa é a diferença entre o pagamento aprovado e o total. Só age quando o
 * pago é MAIOR que o total, então o checkout da loja (cartão = total cheio) e o
 * Pix (pago = total) passam direto. Idempotente pela linha: a segunda chamada
 * acha a "Taxa do cartão" e não faz nada.
 *
 * Chamada dentro de transicionarParaPago, antes de a venda ir para o caixa, na
 * MESMA transação (o webhook e a action gravam o Pagamento antes).
 */
export async function registrarTaxaCartaoTx(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const o = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      tipo: true,
      origem: true,
      subtotal: true,
      total: true,
      items: { where: { nomeProduto: ITEM_TAXA_CARTAO }, select: { id: true } },
      pagamentos: {
        where: { status: "PAGO", metodo: "CARTAO" },
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { valor: true },
      },
    },
  });
  if (!o) return;
  if (o.tipo !== "COBRANCA" && o.origem !== "LEILAO") return;
  if (o.items.length > 0) return;

  const pago = Number(o.pagamentos[0]?.valor ?? 0);
  const total = Number(o.total);
  const taxa = round2(pago - total);
  if (!(taxa >= 0.01)) return;
  // Diferença grande demais não é taxa de cartão (valor editado no meio do
  // caminho, pagamento de outro pedido): melhor não mexer e o dono conferir.
  if (taxa > total * 0.3) {
    console.warn(`[taxa-cartao] diferença de ${taxa} no pedido ${orderId} não parece taxa; nada lançado`);
    return;
  }

  await tx.orderItem.create({
    data: {
      orderId,
      productId: null,
      nomeProduto: ITEM_TAXA_CARTAO,
      quantidade: 1,
      precoUnitario: taxa,
    },
  });
  await tx.order.update({
    where: { id: orderId },
    data: { subtotal: round2(Number(o.subtotal) + taxa), total: round2(pago) },
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
