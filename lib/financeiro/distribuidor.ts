import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Caixa do pedido de distribuidor.
 *
 * O revendedor leva o peixe na hora e paga em partes. Cada parte que entra é
 * uma ENTRADA CONFIRMADA ligada ao pedido; o que falta é UMA linha PENDENTE de
 * origem MANUAL, que é como o financeiro reconhece conta a receber (aparece em
 * "contas em aberto" e aceita "dar baixa" de lá mesmo).
 *
 * A conta é sempre refeita a partir do banco: falta = total − entradas
 * confirmadas do pedido. Assim tanto faz se o pagamento foi registrado aqui ou
 * se alguém deu baixa no saldo pelo financeiro, o número fecha.
 *
 * Distribuidor compra peixe, então tudo cai em PEIXES_VIVOS (a estufa).
 */

export const SLUG_VENDAS_DISTRIBUIDOR = "vendas-distribuidor";
const SEGMENTO = "PEIXES_VIVOS" as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

async function idCategoria(tx: Prisma.TransactionClient): Promise<string> {
  const c = await tx.categoriaFinanceira.upsert({
    where: { slug: SLUG_VENDAS_DISTRIBUIDOR },
    create: {
      slug: SLUG_VENDAS_DISTRIBUIDOR,
      nome: "Vendas para distribuidores",
      tipo: "ENTRADA",
      segmentoPadrao: SEGMENTO,
      ordem: 2,
    },
    update: {},
    select: { id: true },
  });
  return c.id;
}

/** Soma do que já entrou de fato no caixa por este pedido. */
async function totalRecebido(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<number> {
  const r = await tx.lancamento.aggregate({
    where: { orderId, tipo: "ENTRADA", status: "CONFIRMADO" },
    _sum: { valor: true },
  });
  return Number(r._sum.valor ?? 0);
}

/** Lança uma parte paga pelo distribuidor como dinheiro que já entrou. */
export async function registrarRecebimentoDistribuidor(
  tx: Prisma.TransactionClient,
  args: {
    orderId: string;
    valor: number;
    data: Date;
    forma: string;
    criadoPorId: string | null;
  },
): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: args.orderId },
    select: { numero: true, cliente: { select: { nome: true } } },
  });
  if (!order) throw new Error("Pedido não encontrado.");

  await tx.lancamento.create({
    data: {
      segmento: SEGMENTO,
      tipo: "ENTRADA",
      status: "CONFIRMADO",
      origem: "PEDIDO",
      descricao: `Distribuidor ${order.numero} — ${order.cliente.nome} (${args.forma.toLowerCase()})`,
      valor: round2(args.valor),
      data: args.data,
      categoriaId: await idCategoria(tx),
      orderId: args.orderId,
      criadoPorId: args.criadoPorId,
    },
  });
}

/**
 * Deixa a conta a receber do pedido igual ao que falta pagar: cria, ajusta o
 * valor ou apaga quando quitou. Devolve quanto falta.
 *
 * `vencimento` undefined mantém o que já estava na linha.
 */
export async function sincronizarSaldoDistribuidor(
  tx: Prisma.TransactionClient,
  orderId: string,
  vencimento?: Date | null,
): Promise<number> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { numero: true, total: true, cliente: { select: { nome: true } } },
  });
  if (!order) throw new Error("Pedido não encontrado.");

  const falta = round2(Number(order.total) - (await totalRecebido(tx, orderId)));
  const aberta = await tx.lancamento.findFirst({
    where: { orderId, tipo: "ENTRADA", status: "PENDENTE", origem: "MANUAL" },
    select: { id: true },
  });

  if (!(falta > 0)) {
    if (aberta) await tx.lancamento.delete({ where: { id: aberta.id } });
    return 0;
  }

  if (aberta) {
    await tx.lancamento.update({
      where: { id: aberta.id },
      data: {
        valor: falta,
        ...(vencimento !== undefined ? { vencimento } : {}),
      },
    });
  } else {
    await tx.lancamento.create({
      data: {
        segmento: SEGMENTO,
        tipo: "ENTRADA",
        status: "PENDENTE",
        origem: "MANUAL",
        descricao: `A receber: distribuidor ${order.numero} — ${order.cliente.nome}`,
        valor: falta,
        data: vencimento ?? new Date(),
        vencimento: vencimento ?? null,
        categoriaId: await idCategoria(tx),
        orderId,
      },
    });
  }
  return falta;
}

export type ResumoDistribuidor = {
  recebido: number;
  falta: number;
  vencimento: Date | null;
  recebimentos: { id: string; valor: number; data: Date; descricao: string }[];
};

/** O que a página do pedido mostra: quanto entrou, quanto falta e quando. */
export async function resumoDistribuidor(
  tx: Prisma.TransactionClient,
  orderId: string,
  total: number,
): Promise<ResumoDistribuidor> {
  const [entradas, aberta] = await Promise.all([
    tx.lancamento.findMany({
      where: { orderId, tipo: "ENTRADA", status: "CONFIRMADO" },
      orderBy: { data: "asc" },
      select: { id: true, valor: true, data: true, descricao: true },
    }),
    tx.lancamento.findFirst({
      where: { orderId, tipo: "ENTRADA", status: "PENDENTE", origem: "MANUAL" },
      select: { vencimento: true },
    }),
  ]);
  const recebido = round2(entradas.reduce((s, l) => s + Number(l.valor), 0));
  return {
    recebido,
    falta: Math.max(0, round2(total - recebido)),
    vencimento: aberta?.vencimento ?? null,
    recebimentos: entradas.map((l) => ({
      id: l.id,
      valor: Number(l.valor),
      data: l.data,
      descricao: l.descricao,
    })),
  };
}
