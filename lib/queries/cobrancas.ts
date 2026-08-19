import { prisma } from "../prisma";
import { SITE_URL } from "../seo";
import type { Prisma, OrderStatus } from "../generated/prisma/client";

/**
 * Cobrança avulsa — leitura.
 *
 * Cobrança é um Order com `tipo = COBRANCA`: um item avulso (sem produto), sem
 * frete e sem envio. Mora na mesma tabela de propósito — webhook, estorno, caixa
 * e histórico já sabem lidar com Order, e a cobrança herda tudo isso de graça.
 * O que muda é a porta de entrada do cliente: em vez do checkout, um link com
 * token (`Order.publicToken`) que leva ao checkout do gateway.
 */

/** URL do link que vai para o cliente. */
export function linkDaCobranca(token: string): string {
  return `${SITE_URL}/cobrar/${token}`;
}

/** Situação da cobrança para a UI — mais direta que o OrderStatus cru. */
export type SituacaoCobranca = "PAGA" | "EXPIRADA" | "CANCELADA" | "ABERTA";

export function situacaoDaCobranca(o: {
  status: OrderStatus;
  expiraEm: Date | null;
}): SituacaoCobranca {
  if (o.status === "PAGO" || o.status === "ENVIADO" || o.status === "ENTREGUE") {
    return "PAGA";
  }
  if (o.status === "CANCELADO") return "CANCELADA";
  if (o.expiraEm && o.expiraEm.getTime() < Date.now()) return "EXPIRADA";
  return "ABERTA";
}

/**
 * Fecha as cobranças que passaram da validade. Varredura oportunista (sem cron),
 * chamada ao abrir /admin/cobrancas — mesma ideia da limpeza de pedidos órfãos.
 * Nunca toca quem já tem pagamento aprovado ou em análise: o cliente pagou nos
 * 45 do segundo tempo e o webhook ainda pode chegar. Devolve quantas fechou.
 */
export async function cancelarCobrancasExpiradas(): Promise<number> {
  const res = await prisma.order.updateMany({
    where: {
      tipo: "COBRANCA",
      status: "AGUARDANDO_PAGAMENTO",
      expiraEm: { lt: new Date() },
      pagamentos: { none: { status: { in: ["PAGO", "EM_ANALISE"] } } },
    },
    data: { status: "CANCELADO" },
  });
  return res.count;
}

// ── Lista (/admin/cobrancas) ─────────────────────────────────────────────────
export async function listCobrancas({
  situacao,
  q,
}: {
  situacao?: SituacaoCobranca;
  q?: string;
}) {
  const where: Prisma.OrderWhereInput = { tipo: "COBRANCA" };
  const termo = q?.trim();
  if (termo) {
    where.OR = [
      { numero: { contains: termo, mode: "insensitive" } },
      { cliente: { nome: { contains: termo, mode: "insensitive" } } },
      { items: { some: { nomeProduto: { contains: termo, mode: "insensitive" } } } },
    ];
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      numero: true,
      status: true,
      total: true,
      criadoEm: true,
      expiraEm: true,
      publicToken: true,
      maxParcelas: true,
      observacoes: true,
      cliente: { select: { id: true, nome: true, telefone: true, email: true } },
      items: { select: { nomeProduto: true }, take: 1 },
      pagamentos: {
        orderBy: { criadoEm: "desc" },
        take: 1,
        select: { metodo: true, status: true, parcelas: true, criadoEm: true },
      },
    },
  });

  const lista = rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    descricao: r.items[0]?.nomeProduto ?? "Cobrança",
    total: Number(r.total),
    criadoEm: r.criadoEm,
    expiraEm: r.expiraEm,
    publicToken: r.publicToken,
    maxParcelas: r.maxParcelas,
    observacoes: r.observacoes,
    clienteId: r.cliente.id,
    clienteNome: r.cliente.nome,
    clienteTelefone: r.cliente.telefone,
    clienteEmail: r.cliente.email,
    ultimoPagamento: r.pagamentos[0] ?? null,
    situacao: situacaoDaCobranca(r),
  }));

  // Situação é derivada (status + validade), então filtra depois da consulta.
  return situacao ? lista.filter((c) => c.situacao === situacao) : lista;
}

export type CobrancaListItem = Awaited<ReturnType<typeof listCobrancas>>[number];

// ── Página pública (/cobrar/[token]) ─────────────────────────────────────────
export async function getCobrancaPorToken(token: string) {
  const o = await prisma.order.findFirst({
    where: { tipo: "COBRANCA", publicToken: token },
    select: {
      id: true,
      numero: true,
      status: true,
      total: true,
      expiraEm: true,
      maxParcelas: true,
      observacoes: true,
      cliente: { select: { nome: true } },
      items: { select: { nomeProduto: true }, take: 1 },
    },
  });
  if (!o) return null;

  return {
    id: o.id,
    numero: o.numero,
    descricao: o.items[0]?.nomeProduto ?? "Cobrança",
    total: Number(o.total),
    expiraEm: o.expiraEm,
    maxParcelas: o.maxParcelas,
    observacoes: o.observacoes,
    clienteNome: o.cliente.nome,
    situacao: situacaoDaCobranca(o),
  };
}

export type CobrancaPublica = NonNullable<
  Awaited<ReturnType<typeof getCobrancaPorToken>>
>;

// ── Detalhe (/admin/cobrancas/[id]) ──────────────────────────────────────────
export async function getCobrancaById(id: string) {
  const o = await prisma.order.findFirst({
    where: { id, tipo: "COBRANCA" },
    select: {
      id: true,
      numero: true,
      status: true,
      total: true,
      criadoEm: true,
      expiraEm: true,
      publicToken: true,
      maxParcelas: true,
      observacoes: true,
      cliente: { select: { id: true, nome: true, telefone: true, email: true } },
      items: { select: { nomeProduto: true }, take: 1 },
      pagamentos: {
        orderBy: { criadoEm: "desc" },
        select: {
          id: true,
          provider: true,
          metodo: true,
          status: true,
          valor: true,
          parcelas: true,
          bandeira: true,
          estornadoEm: true,
          criadoEm: true,
        },
      },
    },
  });
  if (!o) return null;

  return {
    id: o.id,
    numero: o.numero,
    descricao: o.items[0]?.nomeProduto ?? "Cobrança",
    total: Number(o.total),
    criadoEm: o.criadoEm,
    expiraEm: o.expiraEm,
    publicToken: o.publicToken,
    maxParcelas: o.maxParcelas,
    observacoes: o.observacoes,
    cliente: o.cliente,
    pagamentos: o.pagamentos.map((p) => ({ ...p, valor: Number(p.valor) })),
    situacao: situacaoDaCobranca(o),
  };
}

export type CobrancaDetalhe = NonNullable<
  Awaited<ReturnType<typeof getCobrancaById>>
>;
