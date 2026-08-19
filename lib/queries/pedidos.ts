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
      tipo: "PEDIDO", // cobrança avulsa tem validade própria (Order.expiraEm)
      status: "AGUARDANDO_PAGAMENTO",
      criadoEm: { lt: limite },
      pagamentos: { none: { status: { in: ["PAGO", "EM_ANALISE"] } } },
    },
    data: { status: "CANCELADO" },
  });
  return res.count;
}

// ── Lista (/admin/pedidos) ────────────────────────────────────
// Transportadora "efetiva" do pedido: GOLLOG quando é aéreo, JADLOG quando é
// terrestre. Usa o enum transportadora e, como reforço, a modalidadeFrete
// (AEREO=Gollog, TERRESTRE=Jadlog) — assim o filtro não perde pedido antigo em
// que só um dos dois campos ficou preenchido.
export type TransporteFiltro = "GOLLOG" | "JADLOG";

function transporteWhere(t: TransporteFiltro): Prisma.OrderWhereInput {
  return t === "GOLLOG"
    ? { OR: [{ transportadora: "GOLLOG" }, { modalidadeFrete: "AEREO" }] }
    : { OR: [{ transportadora: "JADLOG" }, { modalidadeFrete: "TERRESTRE" }] };
}

export async function listPedidos({
  status,
  q,
  entrega,
  transporte,
}: {
  status?: OrderStatus;
  q?: string;
  entrega?: TipoEntrega;
  transporte?: TransporteFiltro;
}) {
  // tipo PEDIDO: cobrança avulsa tem lista própria (/admin/cobrancas).
  const where: Prisma.OrderWhereInput = { tipo: "PEDIDO" };
  if (status) where.status = status;
  if (entrega) where.tipoEntrega = entrega;
  // Vários grupos OR (busca + transportadora) convivem via AND.
  const and: Prisma.OrderWhereInput[] = [];
  const termo = q?.trim();
  if (termo) {
    and.push({
      OR: [
        { numero: { contains: termo, mode: "insensitive" } },
        { cliente: { nome: { contains: termo, mode: "insensitive" } } },
      ],
    });
  }
  if (transporte) and.push(transporteWhere(transporte));
  if (and.length) where.AND = and;

  const rows = await prisma.order.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      numero: true,
      status: true,
      tipoEntrega: true,
      transportadora: true,
      modalidadeFrete: true,
      codigoRastreio: true,
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
    // Transportadora efetiva para exibir/filtrar na lista (null = ainda indefinida).
    transporte:
      r.transportadora === "GOLLOG" || r.modalidadeFrete === "AEREO"
        ? ("GOLLOG" as const)
        : r.transportadora === "JADLOG" || r.modalidadeFrete === "TERRESTRE"
          ? ("JADLOG" as const)
          : null,
    codigoRastreio: r.codigoRastreio,
    total: Number(r.total),
    criadoEm: r.criadoEm,
    clienteNome: r.cliente.nome,
  }));
}

export type PedidoListItem = Awaited<ReturnType<typeof listPedidos>>[number];

// ── Pedidos do cliente logado (/minha-conta/pedidos), casados por e-mail ───────
// Aceitável casar por e-mail nesta fase: Google verifica e-mail e o linking do
// Facebook está restrito. Vínculo formal Cliente.userId fica para depois.
export async function listPedidosDoCliente(email: string) {
  const rows = await prisma.order.findMany({
    where: { tipo: "PEDIDO", cliente: { email }, status: { not: "RASCUNHO" } },
    orderBy: { criadoEm: "desc" },
    select: { id: true, numero: true, status: true, total: true, criadoEm: true },
  });
  return rows.map((r) => ({ ...r, total: Number(r.total) }));
}

// ── Resumo operacional de envios (cron do Telegram) ───────────────────────────
export type PedidoEnvio = {
  numero: string;
  clienteNome: string;
  tipoEntrega: TipoEntrega;
  // Transportadora EFETIVA (mesma regra do admin): enum transportadora reforçado
  // pela modalidadeFrete (AEREO=Gollog, TERRESTRE=Jadlog). null = a definir.
  transporte: TransporteFiltro | null;
  cidade: string | null;
  uf: string | null;
  itens: { nome: string; qtd: number }[];
  // "Pago em": criadoEm do Pagamento PAGO (estável); fallback atualizadoEm do
  // pedido. Base do alerta de pedido parado há > 7 dias.
  pagoEm: Date;
};

/**
 * Pedidos PAGO (pagos e ainda não enviados) para o resumo de envios. Traz itens,
 * snapshot de cidade/UF, transportadora efetiva e o "pago em". Inclui ENVIO e
 * RETIRADA (a quarentena vale para todos os pagos; as seções de despacho filtram
 * só ENVIO). Ordena do mais antigo para o mais novo.
 */
export async function listPedidosAguardandoEnvio(): Promise<PedidoEnvio[]> {
  const rows = await prisma.order.findMany({
    where: { tipo: "PEDIDO", status: "PAGO" }, // cobrança avulsa não se despacha
    orderBy: { atualizadoEm: "asc" },
    select: {
      numero: true,
      tipoEntrega: true,
      transportadora: true,
      modalidadeFrete: true,
      enderecoEntrega: true,
      atualizadoEm: true,
      cliente: { select: { nome: true } },
      items: { select: { nomeProduto: true, quantidade: true } },
      pagamentos: {
        where: { status: "PAGO" },
        orderBy: { criadoEm: "asc" },
        take: 1,
        select: { criadoEm: true },
      },
    },
  });

  return rows.map((o) => {
    const e = (o.enderecoEntrega ?? {}) as { cidade?: string | null; uf?: string | null };
    const transporte: TransporteFiltro | null =
      o.transportadora === "GOLLOG" || o.modalidadeFrete === "AEREO"
        ? "GOLLOG"
        : o.transportadora === "JADLOG" || o.modalidadeFrete === "TERRESTRE"
          ? "JADLOG"
          : null;
    return {
      numero: o.numero,
      clienteNome: o.cliente.nome,
      tipoEntrega: o.tipoEntrega,
      transporte,
      cidade: e.cidade ?? null,
      uf: e.uf ?? null,
      itens: o.items.map((i) => ({ nome: i.nomeProduto, qtd: i.quantidade })),
      pagoEm: o.pagamentos[0]?.criadoEm ?? o.atualizadoEm,
    };
  });
}

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
    selfTracking: p.selfTracking,
    meShipmentId: p.meShipmentId,
    etiquetaUrl: p.etiquetaUrl,
    enviadoEm: p.enviadoEm,
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
      externalId: pg.externalId,
      estornadoEm: pg.estornadoEm,
      refundId: pg.refundId,
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
