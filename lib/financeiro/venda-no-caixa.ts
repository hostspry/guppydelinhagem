import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { SegmentoFinanceiro } from "@/lib/generated/prisma/enums";
import { SLUG_TAXA_PAGAMENTO, SLUG_VENDAS_SITE } from "./categorias-padrao";
import { hojeNoCaixa } from "./periodo";

/**
 * Ponte entre a venda e o caixa.
 *
 * Cliente pagou, a venda já vale: o pedido pago entra CONFIRMADO, sem fila de
 * conferência (decisão do dono em 21/11/2026), pelo valor que o cliente pagou.
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
 * num lado só mentiria no resultado das duas operações, então repartimos os
 * itens pelo valor. O frete do pedido misto fica INTEIRO na estufa, porque é ela
 * que despacha a caixa com o peixe. A sobra de centavo também fica na estufa,
 * para a soma bater com order.total.
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
  frete: number,
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

  // Pedido misto: produtos levam só a fatia dos itens (já com o desconto). O
  // restante, que inclui o frete inteiro, fica na estufa.
  const semFrete = Math.max(0, total - frete);
  const valorProdutos = porSegmento.get("PRODUTOS") ?? 0;
  const produtos =
    soma > 0 ? Math.round(((semFrete * valorProdutos) / soma) * 100) / 100 : 0;
  return new Map<SegmentoFinanceiro, number>([
    ["PEIXES_VIVOS", Math.round((total - produtos) * 100) / 100],
    ["PRODUTOS", produtos],
  ]);
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

/** A trava (pagamentoId, origem) já tem linha? */
async function existeLinha(
  tx: Prisma.TransactionClient,
  pagamentoId: string,
  origem: "PEDIDO" | "TAXA_PAGAMENTO",
): Promise<boolean> {
  const l = await tx.lancamento.findUnique({
    where: { pagamentoId_origem: { pagamentoId, origem } },
    select: { id: true },
  });
  return l != null;
}

/** Pedido virou PAGO → entrada confirmada no caixa. */
export async function registrarVendaNoCaixa(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      numero: true,
      total: true,
      frete: true,
      origem: true,
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
        select: { id: true, valor: true },
      },
    },
  });
  if (!order) return;

  // Distribuidor paga em partes e tem o próprio registro (distribuidor.ts).
  // Lançar o total aqui contaria a mesma venda duas vezes.
  if (order.origem === "DISTRIBUIDOR") return;

  // Order.total guarda o preço do cartão. O que o cliente pagou de fato (Pix com
  // desconto, por exemplo) está na linha Pagamento.
  const pagamento = order.pagamentos[0];
  const total = Number(pagamento?.valor ?? order.total);
  if (!(total > 0)) return; // pedido zerado (brinde, teste) não vira caixa

  const chave = chaveDoPagamento(pagamento?.id ?? null, order.id);
  const categoriaId = await idCategoria(tx, SLUG_VENDAS_SITE);

  const fatias = repartirPorSegmento(order.items, total, Number(order.frete));
  const misto = fatias.size > 1;
  const nome = order.cliente?.nome ? ` — ${order.cliente.nome}` : "";

  // Confere antes de criar, em vez de upsert: se a linha já existe, ela pode ter
  // sido editada pelo dono, e não queremos sobrescrever isso. Nem create + catch
  // do P2002: no Postgres o erro derruba a transação inteira, e o resto dela
  // (status do pedido, estoque) iria junto.
  for (const [segmento, valor] of fatias) {
    if (!(valor > 0)) continue;
    // Venda dividida precisa de uma chave por fatia: a trava é
    // (pagamentoId, origem), então duas linhas com a mesma chave se
    // atropelariam. Venda de um lado só mantém a chave antiga.
    const pagamentoId = misto ? `${chave}#${segmento}` : chave;
    if (await existeLinha(tx, pagamentoId, "PEDIDO")) continue;
    await tx.lancamento.create({
      data: {
        segmento,
        tipo: "ENTRADA",
        status: "CONFIRMADO",
        origem: "PEDIDO",
        descricao: misto
          ? `Venda ${order.numero}${nome} (${ROTULO_SEGMENTO[segmento]})`
          : `Venda ${order.numero}${nome}`,
        valor,
        data: hojeNoCaixa(),
        categoriaId,
        orderId: order.id,
        pagamentoId,
      },
    });
  }

  // O líquido já chegou (webhook antes da confirmação): a taxa entra junto.
  // Se não chegou, o próximo aviso do webhook lança.
  if (pagamento) await registrarTaxaDoGateway(tx, pagamento.id);
}

const ROTULO_SEGMENTO: Record<SegmentoFinanceiro, string> = {
  PEIXES_VIVOS: "peixes",
  PRODUTOS: "produtos",
};

/**
 * Setembro e outubro ficaram sem taxa e o dono não pediu para mexer (25/11/2026).
 * Um aviso atrasado do gateway sobre venda dessa época não reabre o mês.
 */
const INICIO_TAXA_AUTOMATICA = new Date(Date.UTC(2026, 10, 1));

const ROTULO_PROVIDER: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago",
  PAGBANK: "PagBank",
  PICPAY: "PicPay",
};

/**
 * Taxa do gateway de um pagamento aprovado.
 *
 * A venda entra no caixa pelo valor que o cliente pagou, mas o gateway fica com
 * uma parte (no cartão de link, o acréscimo que o cliente pagou; no Pix, ~0,99%).
 * Sem esta SAÍDA o resultado da estufa mostrava dinheiro que nunca caiu na conta.
 *
 * valor − valorLiquido, no mesmo caixa e no mesmo dia da venda, para cair no mês
 * dela. Pedido misto: a taxa vai toda para a estufa, porque o acréscimo do
 * cartão fica na fatia dos peixes.
 *
 * Idempotente pela trava (pagamentoId, TAXA_PAGAMENTO). Confere antes de criar
 * em vez de pegar o P2002: um erro dentro da transação do Postgres derrubaria o
 * resto dela, e o webhook chama isto a cada reenvio.
 */
export async function registrarTaxaDoGateway(
  tx: Prisma.TransactionClient,
  pagamentoId: string,
): Promise<void> {
  const pag = await tx.pagamento.findUnique({
    where: { id: pagamentoId },
    select: {
      id: true,
      orderId: true,
      provider: true,
      metodo: true,
      parcelas: true,
      status: true,
      valor: true,
      valorLiquido: true,
      order: { select: { numero: true, origem: true } },
    },
  });
  if (!pag || pag.status !== "PAGO" || pag.valorLiquido == null) return;
  if (pag.order.origem === "DISTRIBUIDOR") return;

  const pago = Number(pag.valor);
  const liquido = Number(pag.valorLiquido);
  const taxa = Math.round((pago - liquido) * 100) / 100;
  if (!(taxa >= 0.01)) return;
  // Diferença grande demais não é taxa: melhor não lançar e o dono conferir.
  if (taxa > pago * 0.3) {
    console.warn(`[caixa] taxa de ${taxa} no pagamento ${pag.id} não parece taxa; nada lançado`);
    return;
  }

  if (await existeLinha(tx, pag.id, "TAXA_PAGAMENTO")) return;

  // Sem venda no caixa (pedido zerado, distribuidor) não há taxa a lançar.
  const vendas = await tx.lancamento.findMany({
    where: { orderId: pag.orderId, tipo: "ENTRADA", origem: "PEDIDO", status: "CONFIRMADO" },
    orderBy: { data: "asc" },
    select: { segmento: true, data: true },
  });
  if (vendas.length === 0) return;
  const dia = vendas[0].data;
  if (dia < INICIO_TAXA_AUTOMATICA) return;

  const forma =
    pag.metodo === "CARTAO"
      ? `cartão ${pag.parcelas ?? 1}x`
      : pag.metodo === "PIX"
        ? "Pix"
        : pag.metodo.toLowerCase();

  await tx.lancamento.create({
    data: {
      segmento: vendas.some((v) => v.segmento === "PEIXES_VIVOS")
        ? "PEIXES_VIVOS"
        : "PRODUTOS",
      tipo: "SAIDA",
      status: "CONFIRMADO",
      origem: "TAXA_PAGAMENTO",
      descricao: `Taxa do ${ROTULO_PROVIDER[pag.provider] ?? pag.provider}, ${pag.order.numero} (${forma})`,
      valor: taxa,
      data: dia,
      categoriaId: await idCategoria(tx, SLUG_TAXA_PAGAMENTO),
      orderId: pag.orderId,
      pagamentoId: pag.id,
      observacoes: `Pago R$ ${pago.toFixed(2)}, caiu R$ ${liquido.toFixed(2)}`,
    },
  });
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
  // MANUAL entra por causa do pedido de distribuidor: o saldo a receber dele é
  // uma linha manual ligada ao pedido (lib/financeiro/distribuidor.ts).
  const entradas = await tx.lancamento.findMany({
    where: { orderId, origem: { in: ["PEDIDO", "MANUAL"] }, tipo: "ENTRADA" },
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

    // Chave própria: a devolução é uma linha distinta da venda, mas também só
    // pode existir uma por venda. Confere antes (ver registrarVendaNoCaixa).
    const chave = `devolucao:${entrada.pagamentoId ?? entrada.id}`;
    if (await existeLinha(tx, chave, "PEDIDO")) continue;
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
        pagamentoId: chave,
      },
    });
  }

  // No estorno total o Mercado Pago devolve a tarifa que cobrou. Sem esta volta,
  // venda estornada deixaria a taxa como prejuízo. Mesma ideia da devolução:
  // uma linha nova no dia do estorno, sem reescrever o mês da venda.
  const taxas = await tx.lancamento.findMany({
    where: { orderId, origem: "TAXA_PAGAMENTO", tipo: "SAIDA", status: "CONFIRMADO" },
    select: { id: true, valor: true, pagamentoId: true, categoriaId: true, segmento: true },
  });
  for (const t of taxas) {
    const chave = `devolucao:${t.pagamentoId ?? t.id}`;
    if (await existeLinha(tx, chave, "TAXA_PAGAMENTO")) continue;
    await tx.lancamento.create({
      data: {
        segmento: t.segmento,
        tipo: "ENTRADA",
        status: "CONFIRMADO",
        origem: "TAXA_PAGAMENTO",
        descricao: `Taxa devolvida no estorno ${order?.numero ?? ""}`.trim(),
        valor: t.valor,
        data: hojeNoCaixa(),
        categoriaId: t.categoriaId,
        orderId,
        pagamentoId: chave,
      },
    });
  }
}
