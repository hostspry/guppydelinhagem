import { prisma } from "../prisma";
import type {
  Prisma,
  OrderStatus,
  TipoEntrega,
} from "../generated/prisma/client";
import type { EnderecoEntrega } from "../validations/pedido";

const LIMITE_ORFAO_HORAS = 24;

/**
 * Varredura oportunista (sem cron): cancela pedidos AGUARDANDO_PAGAMENTO órfãos —
 * mais velhos que 24h e SEM pagamento aprovado nem em análise (esses ainda podem
 * virar PAGO pelo webhook). NÃO mexe em estoque (órfãos nunca baixaram — só baixa
 * no PAGO). Idempotente; devolve quantos foram cancelados. Chamada ao abrir
 * /admin/pedidos. Nunca toca pedidos recentes (<24h) nem pagos.
 */
export async function cancelarPedidosAguardandoExpirados(): Promise<number> {
  const limite = new Date(Date.now() - LIMITE_ORFAO_HORAS * 60 * 60 * 1000);
  const res = await prisma.order.updateMany({
    where: {
      status: "AGUARDANDO_PAGAMENTO",
      criadoEm: { lt: limite },
      pagamentos: { none: { status: { in: ["PAGO", "EM_ANALISE"] } } },
    },
    data: { status: "CANCELADO" },
  });
  return res.count;
}

// ── Lista (/admin/pedidos) ────────────────────────────────────
export async function listPedidos({
  status,
  q,
  entrega,
}: {
  status?: OrderStatus;
  q?: string;
  entrega?: TipoEntrega;
}) {
  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;
  if (entrega) where.tipoEntrega = entrega;
  const termo = q?.trim();
  if (termo) {
    where.OR = [
      { numero: { contains: termo, mode: "insensitive" } },
      { cliente: { nome: { contains: termo, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      numero: true,
      status: true,
      tipoEntrega: true,
      total: true,
      criadoEm: true,
      cliente: { select: { nome: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    status: r.status,
    tipoEntrega: r.tipoEntrega,
    total: Number(r.total),
    criadoEm: r.criadoEm,
    clienteNome: r.cliente.nome,
  }));
}

export type PedidoListItem = Awaited<ReturnType<typeof listPedidos>>[number];

// ── Detalhe (/admin/pedidos/[id]) ─────────────────────────────
export async function getPedidoById(id: string) {
  const p = await prisma.order.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, nome: true } },
      items: true,
      pagamentos: { orderBy: { criadoEm: "desc" } },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    numero: p.numero,
    ano: p.ano,
    sequencia: p.sequencia,
    status: p.status,
    tipoEntrega: p.tipoEntrega,
    formaPagamento: p.formaPagamento,
    transportadora: p.transportadora,
    codigoRastreio: p.codigoRastreio,
    observacoes: p.observacoes,
    clienteId: p.clienteId,
    clienteNome: p.cliente.nome,
    enderecoEntrega: p.enderecoEntrega as unknown as EnderecoEntrega,
    subtotal: Number(p.subtotal),
    frete: Number(p.frete),
    desconto: Number(p.desconto),
    total: Number(p.total),
    criadoEm: p.criadoEm,
    itens: p.items.map((it) => ({
      id: it.id,
      produtoId: it.productId,
      nomeProduto: it.nomeProduto,
      imagemSnapshot: it.imagemSnapshot,
      precoUnitario: Number(it.precoUnitario),
      quantidade: it.quantidade,
      composicao: it.composicao,
      subtotal: Number(it.precoUnitario) * it.quantidade,
    })),
    pagamentos: p.pagamentos.map((pg) => ({
      id: pg.id,
      provider: pg.provider,
      metodo: pg.metodo,
      status: pg.status,
      valor: Number(pg.valor),
      criadoEm: pg.criadoEm,
    })),
  };
}

export type PedidoDetalhe = NonNullable<
  Awaited<ReturnType<typeof getPedidoById>>
>;

// ── Dados para o formulário (selects de cliente e produto) ─────
export async function getPedidoFormData() {
  const [clientes, produtos] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.product.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        preco: true,
        tipo: true,
        variantes: {
          where: { ativo: true },
          orderBy: [{ padrao: "desc" }, { ordem: "asc" }],
          select: {
            composicao: true,
            preco: true,
            rotulo: true,
            qtdMachos: true,
            qtdFemeas: true,
          },
        },
      },
    }),
  ]);

  return {
    clientes,
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: p.nome,
      preco: Number(p.preco),
      tipo: p.tipo,
      variantes: p.variantes.map((v) => ({
        composicao: v.composicao,
        preco: Number(v.preco),
        rotulo: v.rotulo,
        qtdMachos: v.qtdMachos,
        qtdFemeas: v.qtdFemeas,
      })),
    })),
  };
}
