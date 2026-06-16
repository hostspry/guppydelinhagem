import { prisma } from "../prisma";
import type { Prisma, OrderStatus } from "../generated/prisma/client";
import type { EnderecoEntrega } from "../validations/pedido";

// ── Lista (/admin/pedidos) ────────────────────────────────────
export async function listPedidos({
  status,
  q,
}: {
  status?: OrderStatus;
  q?: string;
}) {
  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;
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
      total: true,
      criadoEm: true,
      cliente: { select: { nome: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    numero: r.numero,
    status: r.status,
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
      select: { id: true, nome: true, preco: true },
    }),
  ]);

  return {
    clientes,
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: p.nome,
      preco: Number(p.preco),
    })),
  };
}
