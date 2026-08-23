import { prisma } from "@/lib/prisma";

// Status derivado de um cupom (para badge na lista do admin). "esgotado" aqui =
// limite de usos atingido. O encerramento por estoque é checado no momento da
// aplicação (lib/cupom.ts), não vira badge na lista (evita varrer estoque aqui).
export type CupomStatus =
  | "vigente"
  | "agendado"
  | "expirado"
  | "esgotado"
  | "inativo";

export const CUPOM_STATUS_LABEL: Record<CupomStatus, string> = {
  vigente: "Vigente",
  agendado: "Agendado",
  expirado: "Expirado",
  esgotado: "Esgotado",
  inativo: "Inativo",
};

function derivarStatus(c: {
  ativo: boolean;
  validoDe: Date | null;
  validoAte: Date | null;
  limiteUsos: number | null;
  usosRealizados: number;
}): CupomStatus {
  if (!c.ativo) return "inativo";
  const agora = new Date();
  if (c.validoDe && agora < c.validoDe) return "agendado";
  if (c.validoAte && agora > c.validoAte) return "expirado";
  if (c.limiteUsos != null && c.usosRealizados >= c.limiteUsos) {
    return "esgotado";
  }
  return "vigente";
}

export type CupomListItem = {
  id: string;
  codigo: string;
  descricao: string | null;
  tipoValor: "PERCENTUAL" | "VALOR_FIXO" | "PRECO_FIXO";
  valor: number;
  escopo: "TODOS" | "CATEGORIAS" | "PRODUTOS";
  modoAplicacao: "AMBOS_VENCE_MAIOR" | "AMBOS_ACUMULA" | "SO_PIX" | "SO_CARTAO";
  ativo: boolean;
  validoDe: Date | null;
  validoAte: Date | null;
  limiteUsos: number | null;
  usosRealizados: number;
  status: CupomStatus;
  qtdCategorias: number;
  qtdProdutos: number;
  qtdPedidos: number;
};

/** Lista de cupons para o admin, com busca por código/descrição e status derivado. */
export async function listCupons(opts?: { q?: string }): Promise<CupomListItem[]> {
  const q = opts?.q?.trim();
  const cupons = await prisma.cupomDesconto.findMany({
    where: q
      ? {
          OR: [
            { codigo: { contains: q, mode: "insensitive" } },
            { descricao: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { criadoEm: "desc" },
    include: {
      _count: { select: { categorias: true, produtos: true, pedidos: true } },
    },
  });

  return cupons.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    descricao: c.descricao,
    tipoValor: c.tipoValor,
    valor: Number(c.valor),
    escopo: c.escopo,
    modoAplicacao: c.modoAplicacao,
    ativo: c.ativo,
    validoDe: c.validoDe,
    validoAte: c.validoAte,
    limiteUsos: c.limiteUsos,
    usosRealizados: c.usosRealizados,
    status: derivarStatus(c),
    qtdCategorias: c._count.categorias,
    qtdProdutos: c._count.produtos,
    qtdPedidos: c._count.pedidos,
  }));
}

export type CupomDetalhe = {
  id: string;
  codigo: string;
  descricao: string | null;
  tipoValor: "PERCENTUAL" | "VALOR_FIXO" | "PRECO_FIXO";
  valor: number;
  escopo: "TODOS" | "CATEGORIAS" | "PRODUTOS";
  modoAplicacao: "AMBOS_VENCE_MAIOR" | "AMBOS_ACUMULA" | "SO_PIX" | "SO_CARTAO";
  tipoCupom: "SECRETO" | "CAMPANHA";
  precoUnicoNaCampanha: boolean;
  ativo: boolean;
  validoDe: Date | null;
  validoAte: Date | null;
  limiteUsos: number | null;
  usosRealizados: number;
  encerraAoEsgotarEstoque: boolean;
  pedidoMinimo: number | null;
  categoriaIds: string[];
  produtoIds: string[];
};

/** Cupom por id, com ids de categorias/produtos para pré-selecionar no form. */
export async function getCupomById(id: string): Promise<CupomDetalhe | null> {
  const c = await prisma.cupomDesconto.findUnique({
    where: { id },
    include: {
      categorias: { select: { id: true } },
      produtos: { select: { id: true } },
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    codigo: c.codigo,
    descricao: c.descricao,
    tipoValor: c.tipoValor,
    valor: Number(c.valor),
    escopo: c.escopo,
    modoAplicacao: c.modoAplicacao,
    tipoCupom: c.tipoCupom,
    precoUnicoNaCampanha: c.precoUnicoNaCampanha,
    ativo: c.ativo,
    validoDe: c.validoDe,
    validoAte: c.validoAte,
    limiteUsos: c.limiteUsos,
    usosRealizados: c.usosRealizados,
    encerraAoEsgotarEstoque: c.encerraAoEsgotarEstoque,
    pedidoMinimo: c.pedidoMinimo == null ? null : Number(c.pedidoMinimo),
    categoriaIds: c.categorias.map((x) => x.id),
    produtoIds: c.produtos.map((x) => x.id),
  };
}

/**
 * Cupom por código (normalizado UPPERCASE), com o necessário para validar e aplicar
 * no carrinho/checkout: ids de categorias/produtos do escopo e o estoque dos
 * produtos do escopo (para a regra "encerra ao esgotar estoque"). Retorna o objeto
 * Prisma cru — o caller converte os Decimais e monta o CupomCalculo.
 */
export async function getCupomByCodigo(codigoNormalizado: string) {
  return prisma.cupomDesconto.findUnique({
    where: { codigo: codigoNormalizado },
    include: {
      categorias: {
        select: {
          id: true,
          produtos: { select: { estoqueMachos: true, estoqueFemeas: true } },
        },
      },
      produtos: {
        select: { id: true, estoqueMachos: true, estoqueFemeas: true },
      },
    },
  });
}

export type OpcaoSelecao = { id: string; nome: string };

/** Categorias e produtos (id + nome) para os multi-selects do form de cupom. */
export async function getCupomFormData(): Promise<{
  categorias: OpcaoSelecao[];
  produtos: OpcaoSelecao[];
}> {
  const [categorias, produtos] = await Promise.all([
    prisma.category.findMany({
      orderBy: { ordem: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.product.findMany({
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);
  return { categorias, produtos };
}
