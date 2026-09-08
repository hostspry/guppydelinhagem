import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { SegmentoFinanceiro } from "@/lib/generated/prisma/enums";
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

/**
 * Reparte o total de uma venda entre as unidades de negócio.
 *
 * Um pedido pode misturar peixe e produto seco (o carrinho permite). Jogar tudo
 * num lado só mentiria no resultado das duas operações, então repartimos pelo
 * valor dos itens e rateamos o frete na mesma proporção. A sobra de centavo do
 * arredondamento fica com o maior segmento, para a soma bater com order.total.
 *
 * Item sem produto no catálogo (venda avulsa, produto excluído) conta como
 * peixe: é o que a loja vendeu a vida toda, e é o palpite que erra menos.
 */
function repartirPorSegmento(
  itens: {
    quantidade: number;
    precoUnitario: Prisma.Decimal;
    descontoUnitario: Prisma.Decimal | null;
    qtdMachos: number | null;
    product: { tipo: string } | null;
  }[],
  total: number,
): Map<SegmentoFinanceiro, number> {
  const porSegmento = new Map<SegmentoFinanceiro, number>();
  let soma = 0;

  for (const it of itens) {
    const tipo = it.product?.tipo ?? null;
    const seco = tipo != null && !SEGMENTO_VIVO.has(tipo);
    // Sem produto no catálogo: se a linha guardou receita de peixe, é peixe.
    const seg: SegmentoFinanceiro =
      tipo == null
        ? it.qtdMachos != null
          ? "PEIXES_VIVOS"
          : "PEIXES_VIVOS"
        : seco
          ? "PRODUTOS"
          : "PEIXES_VIVOS";
    const unit = Number(it.precoUnitario) - Number(it.descontoUnitario ?? 0);
    const valor = Math.max(0, unit) * it.quantidade;
    porSegmento.set(seg, (porSegmento.get(seg) ?? 0) + valor);
    soma += valor;
  }

  if (porSegmento.size === 0) return new Map([["PEIXES_VIVOS", total]]);
  if (porSegmento.size === 1) {
    const [unico] = [...porSegmento.keys()];
    return new Map([[unico, total]]);
  }

  // Rateio: cada lado leva sua fatia do total (que já inclui frete e desconto).
  const entradas = [...porSegmento.entries()].sort((a, b) => b[1] - a[1]);
  const resultado = new Map<SegmentoFinanceiro, number>();
  let distribuido = 0;
  entradas.forEach(([seg, valor], i) => {
    if (i === entradas.length - 1) {
      resultado.set(seg, Math.round((total - distribuido) * 100) / 100);
      return;
    }
    const fatia = soma > 0 ? Math.round((total * valor) / soma * 100) / 100 : 0;
    resultado.set(seg, fatia);
    distribuido += fatia;
  });
  return resultado;
}

/** Tipos de produto que são carga viva — a estufa. */
const SEGMENTO_VIVO = new Set(["PEIXE", "CORAL", "PLANTA", "ALIMENTO_VIVO"]);

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
      items: {
        select: {
          quantidade: true,
          precoUnitario: true,
          descontoUnitario: true,
          qtdMachos: true,
          product: { select: { tipo: true } },
        },
      },
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

  const fatias = repartirPorSegmento(order.items, total);
  const misto = fatias.size > 1;
  const nome = order.cliente?.nome ? ` — ${order.cliente.nome}` : "";

  // create + catch do P2002 em vez de upsert: se a linha já existe, ela pode ter
  // sido confirmada ou editada pelo dono, e não queremos sobrescrever isso.
  for (const [segmento, valor] of fatias) {
    if (!(valor > 0)) continue;
    try {
      await tx.lancamento.create({
        data: {
          segmento,
          tipo: "ENTRADA",
          status: "PENDENTE",
          origem: "PEDIDO",
          descricao: misto
            ? `Venda ${order.numero}${nome} (${ROTULO_SEGMENTO[segmento]})`
            : `Venda ${order.numero}${nome}`,
          valor,
          data: new Date(),
          categoriaId,
          orderId: order.id,
          // Venda dividida precisa de uma chave por fatia: a trava é
          // (pagamentoId, origem), então duas linhas com a mesma chave se
          // atropelariam. Venda de um lado só mantém a chave antiga.
          pagamentoId: misto ? `${chave}#${segmento}` : chave,
        },
      });
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      if (code !== "P2002") throw e;
    }
  }
}

const ROTULO_SEGMENTO: Record<SegmentoFinanceiro, string> = {
  PEIXES_VIVOS: "peixes",
  PRODUTOS: "produtos",
};

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
    select: {
      id: true,
      status: true,
      valor: true,
      pagamentoId: true,
      categoriaId: true,
      segmento: true,
    },
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
          // A devolução volta para o mesmo caixa de onde a venda entrou.
          segmento: entrada.segmento,
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
