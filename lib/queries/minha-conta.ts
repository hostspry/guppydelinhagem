import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { EnderecoEntrega } from "@/lib/validations/pedido";

// Queries do painel do cliente (/minha-conta). Posse é SEMPRE checada: pedidos e
// esperas do usuário logado, casados por Cliente.userId (fonte de verdade) com
// fallback por e-mail na leitura (cobre a corrida até o auto-link rodar).

/**
 * Auto-link: vincula ao usuário todos os Clientes com o mesmo e-mail e userId
 * nulo (o admin criava clientes à mão; duplicatas por e-mail são o mesmo humano).
 * Idempotente e barato (updateMany). Nunca lança — é acessório ao render.
 */
export async function vincularClientesAoUsuario(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  if (!email) return;
  try {
    await prisma.cliente.updateMany({
      where: { email, userId: null },
      data: { userId },
    });
  } catch (e) {
    console.error("[minha-conta] auto-link falhou", e);
  }
}

// Filtro de posse reutilizável: clientes do usuário (por userId OU e-mail).
function clienteDoUsuario(
  userId: string,
  email: string | null | undefined,
): Prisma.ClienteWhereInput {
  return { OR: [{ userId }, ...(email ? [{ email }] : [])] };
}

// ── Lista de pedidos ──────────────────────────────────────────────────────────
export async function listPedidosDoUsuario(
  userId: string,
  email: string | null | undefined,
) {
  const rows = await prisma.order.findMany({
    where: {
      status: { not: "RASCUNHO" },
      cliente: clienteDoUsuario(userId, email),
    },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      numero: true,
      status: true,
      total: true,
      criadoEm: true,
      transportadora: true,
      codigoRastreio: true,
      enviadoEm: true,
      items: {
        select: { nomeProduto: true, quantidade: true },
        orderBy: { id: "asc" },
      },
    },
  });
  return rows.map((o) => ({ ...o, total: Number(o.total) }));
}

export type PedidoUsuarioLista = Awaited<
  ReturnType<typeof listPedidosDoUsuario>
>[number];

// ── Detalhe de um pedido (com checagem de posse) ──────────────────────────────
export async function getPedidoDoUsuario(
  numeroRaw: string,
  userId: string,
  email: string | null | undefined,
) {
  const limpo = numeroRaw.replace(/^#/, "").trim();
  const p = await prisma.order.findFirst({
    where: {
      numero: { in: [limpo, `#${limpo}`] },
      status: { not: "RASCUNHO" },
      cliente: clienteDoUsuario(userId, email),
    },
    select: {
      id: true,
      numero: true,
      status: true,
      criadoEm: true,
      enviadoEm: true,
      transportadora: true,
      codigoRastreio: true,
      selfTracking: true,
      enderecoEntrega: true,
      subtotal: true,
      frete: true,
      desconto: true,
      total: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          productId: true,
          nomeProduto: true,
          composicao: true,
          quantidade: true,
          precoUnitario: true,
          descontoUnitario: true,
        },
      },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    numero: p.numero,
    status: p.status,
    criadoEm: p.criadoEm,
    enviadoEm: p.enviadoEm,
    transportadora: p.transportadora,
    codigoRastreio: p.codigoRastreio,
    selfTracking: p.selfTracking,
    endereco: (p.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>,
    subtotal: Number(p.subtotal),
    frete: Number(p.frete),
    desconto: Number(p.desconto),
    total: Number(p.total),
    itens: p.items.map((it) => ({
      productId: it.productId,
      nome: it.nomeProduto,
      composicao: it.composicao,
      quantidade: it.quantidade,
      precoUnitario: Number(it.precoUnitario),
      descontoUnitario:
        it.descontoUnitario == null ? 0 : Number(it.descontoUnitario),
    })),
  };
}

export type PedidoUsuarioDetalhe = NonNullable<
  Awaited<ReturnType<typeof getPedidoDoUsuario>>
>;

// ── Lista de espera do usuário ────────────────────────────────────────────────
// Casada por userId OU pelo whatsapp do perfil (quando informado). Só esperas
// ainda não notificadas, com o produto (nome/slug/thumb).
export async function listEsperasDoUsuario(
  userId: string,
  whatsapp: string | null | undefined,
) {
  const wa = (whatsapp ?? "").replace(/\D/g, "");
  const rows = await prisma.waitlistEntry.findMany({
    where: {
      notificado: false,
      OR: [{ userId }, ...(wa ? [{ whatsapp: wa }] : [])],
    },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      criadoEm: true,
      product: {
        select: {
          nome: true,
          slug: true,
          ativo: true,
          videos: {
            where: { ativo: true },
            orderBy: [{ principal: "desc" }, { ordem: "asc" }],
            take: 1,
            select: { thumbnailUrl: true },
          },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    criadoEm: r.criadoEm,
    produtoNome: r.product.nome,
    produtoSlug: r.product.slug,
    produtoAtivo: r.product.ativo,
    thumb: r.product.videos[0]?.thumbnailUrl ?? null,
  }));
}

// ── Perfil e endereços ────────────────────────────────────────────────────────
// Dados do perfil: User (fonte do login) + espelho no Cliente vinculado (telefone,
// cpf). E-mail é somente leitura (vem do login social).
export async function getDadosPerfil(
  userId: string,
  email: string | null | undefined,
) {
  const [user, cliente] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { nome: true, email: true, telefone: true, image: true },
    }),
    prisma.cliente.findFirst({
      where: clienteDoUsuario(userId, email),
      orderBy: { criadoEm: "desc" },
      select: { telefone: true, cpfCnpj: true },
    }),
  ]);
  return {
    nome: user?.nome ?? "",
    email: user?.email ?? email ?? "",
    telefone: user?.telefone ?? cliente?.telefone ?? "",
    cpfCnpj: cliente?.cpfCnpj ?? "",
    image: user?.image ?? null,
  };
}

export function listEnderecos(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ principal: "desc" }, { id: "asc" }],
  });
}

export type EnderecoUsuario = Awaited<ReturnType<typeof listEnderecos>>[number];
