import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import { chaveTelefone } from "@/lib/sorteios/telefone";

/** Chave canônica do telefone (com o 9 do celular), ou o próprio texto. */
const chaveCelular = (t: string) => chaveTelefone(t) ?? t;

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
  emailSessao: string | null | undefined,
): Promise<void> {
  const email = await emailConfiavel(userId, emailSessao);
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

/**
 * O e-mail da sessão só serve para achar pedidos e cadastros antigos quando a
 * gente sabe que ele é da pessoa: veio do Google (emailVerified), ou a conta foi
 * criada pela loja. Conta aberta no formulário /cadastro digitou o e-mail sem
 * confirmar; se valesse, bastaria cadastrar o e-mail de outro cliente para ver
 * os pedidos dele. Essas contas ficam só com o que é delas pelo userId.
 */
async function emailConfiavel(
  userId: string,
  email: string | null | undefined,
): Promise<string | null> {
  if (!email) return null;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { cadastroSiteEm: true, emailVerified: true },
  });
  if (!u) return null;
  return u.cadastroSiteEm && !u.emailVerified ? null : email;
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
  emailSessao: string | null | undefined,
) {
  const email = await emailConfiavel(userId, emailSessao);
  const rows = await prisma.order.findMany({
    where: {
      tipo: "PEDIDO", // cobrança avulsa não entra no histórico de compras
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
  emailSessao: string | null | undefined,
) {
  const email = await emailConfiavel(userId, emailSessao);
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
  let wa = (whatsapp ?? "").replace(/\D/g, "");
  // Mesmo raciocínio do e-mail: telefone digitado no /cadastro não prova nada
  // até ser verificado pelo WhatsApp. Sem isso, cadastrar o número de outra
  // pessoa mostraria a lista de espera dela.
  if (wa) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { cadastroSiteEm: true } });
    if (u?.cadastroSiteEm) {
      const chave = wa.length <= 11 ? `55${wa}` : wa;
      const ok = await prisma.telefoneVerificado.count({ where: { userId, telefone: { in: [chave, chaveCelular(chave)] } } });
      if (!ok) wa = "";
    }
  }
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
          imagens: { orderBy: { ordem: "asc" }, take: 1, select: { url: true } },
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
    thumb:
      r.product.videos[0]?.thumbnailUrl ?? r.product.imagens[0]?.url ?? null,
  }));
}

// ── Perfil e endereços ────────────────────────────────────────────────────────
// Dados do perfil: User (fonte do login) + espelho no Cliente vinculado (telefone,
// cpf). E-mail é somente leitura (vem do login social).
export async function getDadosPerfil(
  userId: string,
  emailSessao: string | null | undefined,
) {
  const email = await emailConfiavel(userId, emailSessao);
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
