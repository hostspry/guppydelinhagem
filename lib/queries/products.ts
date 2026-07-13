import { cache } from "react";
import { prisma } from "../prisma";
import { ordenarVitrine } from "../estoque";
import { calcularPrecos, type ConfigPreco } from "../precos";
import { getConfigPreco } from "./config";
import { resolverCampanhas } from "../campanha";
import type { CampanhaProduto, CampanhaInfo } from "../campanha-core";
import type { Prisma } from "../generated/prisma/client";
import type { ProductType, TipoComposicao } from "../generated/prisma/enums";

// ─────────────────────────────────────────────────────────────
// Queries públicas (loja) — só produtos ativos. Decimais convertidos para
// number (Decimal do Prisma não serializa para Client Components).
// ─────────────────────────────────────────────────────────────

// Preços JÁ CALCULADOS no servidor (fonte única lib/precos + desconto global da
// loja), pra o card NÃO recalcular e bater com a página do produto.
export type PublicProductCard = {
  id: string;
  nome: string;
  slug: string;
  precoCheio: number; // cartão à vista
  precoPix: number; // com desconto efetivo (próprio ou global)
  descontoPixPercent: number; // % efetivo aplicado no Pix (0 = sem desconto)
  parcelasMax: number;
  estoque: number;
  // Campanha automática vigente (preço promo já calculado), ou null.
  campanha: CampanhaProduto | null;
  video: {
    platform: "YOUTUBE" | "INSTAGRAM" | "TIKTOK";
    thumbnailUrl: string | null;
    videoId: string | null;
    originalUrl: string;
  } | null;
};

const cardSelect = {
  id: true,
  nome: true,
  slug: true,
  preco: true,
  descontoPix: true,
  usarDescontoPixGlobal: true, // p/ aplicar o desconto Pix GLOBAL no card
  parcelasMax: true,
  estoque: true,
  categoryId: true, // escopo de campanha (não vai pro card)
  // Para ordenar a vitrine (esgotados por último; destaque entre disponíveis).
  // Não vão para o card — só alimentam ordenarVitrine / resolução de campanha.
  destaque: true,
  estoqueMachos: true,
  estoqueFemeas: true,
  // Vídeo de capa: principal primeiro, senão o de menor ordem. Só ativos (loja).
  videos: {
    where: { ativo: true },
    orderBy: [{ principal: "desc" }, { ordem: "asc" }],
    take: 1,
    select: {
      platform: true,
      thumbnailUrl: true,
      videoId: true,
      originalUrl: true,
    },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function toCard(p: CardRow, config: ConfigPreco): PublicProductCard {
  const v = p.videos[0];
  // MESMA fonte de preço da página de produto (lib/precos) com o desconto GLOBAL
  // da loja — Pix/cartão batem entre card e página.
  const precos = calcularPrecos(
    {
      precoBase: Number(p.preco),
      descontoPixProprio: p.descontoPix == null ? null : Number(p.descontoPix),
      usarDescontoPixGlobal: p.usarDescontoPixGlobal,
    },
    config,
  );
  return {
    id: p.id,
    nome: p.nome,
    slug: p.slug,
    precoCheio: precos.precoCartao,
    precoPix: precos.precoPix,
    descontoPixPercent: precos.descontoPixPercent,
    parcelasMax: p.parcelasMax,
    estoque: p.estoque,
    campanha: null, // preenchido por anexarCampanhasCards
    video: v
      ? {
          platform: v.platform,
          thumbnailUrl: v.thumbnailUrl,
          videoId: v.videoId,
          originalUrl: v.originalUrl,
        }
      : null,
  };
}

// Anexa a campanha vigente a cada card (resolve 1× via React.cache em lib/campanha).
async function anexarCampanhasCards(
  rows: CardRow[],
  config: ConfigPreco,
): Promise<PublicProductCard[]> {
  const cards = rows.map((r) => toCard(r, config));
  const map = await resolverCampanhas(
    rows.map((r, i) => ({
      id: r.id,
      categoryId: r.categoryId,
      precoCheio: cards[i].precoCheio,
      descontoPixPercent: cards[i].descontoPixPercent,
      estoqueMachos: r.estoqueMachos,
      estoqueFemeas: r.estoqueFemeas,
    })),
  );
  return cards.map((c) => {
    const camp = map.get(c.id);
    return camp ? { ...c, campanha: camp } : c;
  });
}

async function findCards(
  where: Prisma.ProductWhereInput,
  take = 4,
): Promise<PublicProductCard[]> {
  const [rows, config] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      take,
      select: cardSelect,
    }),
    getConfigPreco(),
  ]);
  return anexarCampanhasCards(rows, config);
}

/** "Mais Procurados" = destaque manual (sem vendas registradas ainda). */
export function getDestaques(): Promise<PublicProductCard[]> {
  return findCards({ ativo: true, destaque: true });
}

/** "Últimos Adicionados" = mais recentes. */
export function getUltimosAdicionados(): Promise<PublicProductCard[]> {
  return findCards({ ativo: true });
}

/** "Casais" = categoria casais (vazio se a categoria/produtos não existirem). */
export function getCasais(): Promise<PublicProductCard[]> {
  return findCards({ ativo: true, category: { slug: "casais" } });
}

/** Relacionados: mesma categoria, exceto o próprio (placeholder da Leva 2). */
export function getRelacionados(
  categoryId: string,
  excluirId: string,
  take = 8,
): Promise<PublicProductCard[]> {
  return findCards({ ativo: true, categoryId, id: { not: excluirId } }, take);
}

// ── Listagem /loja (vitrine: busca + categoria + ordenação + paginação) ───────
export type LojaOrdenacao = "recentes" | "menor-preco" | "maior-preco";

export type LojaFilters = {
  busca?: string;
  /** slug da categoria; undefined ou "todos" = sem filtro. */
  categoriaSlug?: string;
  ordenacao?: LojaOrdenacao;
};

/** Tamanho do lote do "carregar mais". */
export const LOJA_PAGE_SIZE = 12;

// Tie-break por id mantém a paginação estável quando há preços iguais.
const ordenacaoMap: Record<LojaOrdenacao, Prisma.ProductOrderByWithRelationInput[]> = {
  recentes: [{ criadoEm: "desc" }, { id: "asc" }],
  "menor-preco": [{ preco: "asc" }, { id: "asc" }],
  "maior-preco": [{ preco: "desc" }, { id: "asc" }],
};

function lojaWhere({ busca, categoriaSlug }: LojaFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { ativo: true };
  const termo = busca?.trim();
  if (termo) {
    // Busca parcial case-insensitive por nome OU linhagem (padraoCor).
    where.OR = [
      { nome: { contains: termo, mode: "insensitive" } },
      { padraoCor: { contains: termo, mode: "insensitive" } },
    ];
  }
  // "destaques" = valor especial da pílula (vitrine de destaque), não uma
  // categoria real → mapeia para destaque:true. "todos"/vazio = sem filtro.
  if (categoriaSlug === "destaques") {
    where.destaque = true;
  } else if (categoriaSlug && categoriaSlug !== "todos") {
    where.category = { slug: categoriaSlug };
  }
  return where;
}

/**
 * Lista produtos ativos da vitrine com filtros combináveis e paginação por
 * offset. Retorna o lote pedido + total (para "X de Y" e saber se há mais).
 */
export async function listProductsLoja(
  filters: LojaFilters & { skip?: number; take?: number },
): Promise<{ items: PublicProductCard[]; total: number }> {
  const where = lojaWhere(filters);
  // "Esgotado" depende de DOIS campos (machos & fêmeas) — o orderBy do Prisma
  // não expressa isso. Como o catálogo é pequeno, buscamos o conjunto filtrado
  // inteiro já ordenado pelo critério escolhido, reordenamos em memória para
  // jogar esgotados ao fim (destaque entre disponíveis) e paginamos por slice.
  // Assim a paginação/contagem continua correta (total = conjunto inteiro).
  const [rows, config] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: ordenacaoMap[filters.ordenacao ?? "recentes"],
      select: cardSelect,
    }),
    getConfigPreco(),
  ]);
  const ordenados = ordenarVitrine(rows);
  const skip = filters.skip ?? 0;
  const take = filters.take ?? LOJA_PAGE_SIZE;
  return {
    items: await anexarCampanhasCards(ordenados.slice(skip, skip + take), config),
    total: ordenados.length,
  };
}

// ── Página de produto (/loja/[slug]) ──────────────────────────
export type ProductDetailVideo = {
  id: string;
  platform: "YOUTUBE" | "INSTAGRAM" | "TIKTOK";
  videoId: string | null;
  thumbnailUrl: string | null;
  originalUrl: string;
  titulo: string | null;
  principal: boolean;
};

export type ProductDetail = {
  id: string;
  nome: string;
  slug: string;
  descricao: string;
  descricaoCurta: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  preco: number;
  descontoPix: number | null;
  usarDescontoPixGlobal: boolean;
  parcelasMax: number;
  estoque: number;
  estoqueMachos: number; // pool (PEIXE)
  estoqueFemeas: number;
  categoria: string;
  categoriaSlug: string;
  categoryId: string;
  tipo: ProductType;
  peso: number | null; // frete de não-peixe
  // Atributos (ficha técnica). Só os preenchidos são exibidos.
  padraoCor: string | null;
  cauda: string | null;
  caracteristica: string | null;
  origem: string | null;
  temperatura: string | null;
  ph: string | null;
  alimentacao: string | null;
  expectativaVida: string | null;
  videos: ProductDetailVideo[];
  // Composições ativas (TRIO/padrão primeiro). Vazio em produtos não-peixe.
  variantes: {
    id: string;
    composicao: TipoComposicao;
    preco: number;
    qtdMachos: number;
    qtdFemeas: number;
    rotulo: string | null;
    padrao: boolean;
  }[];
};

/**
 * Produto público por slug (só ativo). Decimais → number. null se não existir
 * ou estiver inativo (a página chama notFound). cache() dedup a query entre
 * generateMetadata e o render da página no mesmo request.
 */
export const getProductBySlug = cache(
  async (
    slug: string,
    includeInactive = false,
  ): Promise<ProductDetail | null> => {
    const p = await prisma.product.findFirst({
      where: includeInactive ? { slug } : { slug, ativo: true },
      select: {
        id: true,
        nome: true,
        slug: true,
        descricao: true,
        descricaoCurta: true,
        metaTitle: true,
        metaDescription: true,
        preco: true,
        descontoPix: true,
        usarDescontoPixGlobal: true,
        parcelasMax: true,
        estoque: true,
        estoqueMachos: true,
        estoqueFemeas: true,
        categoryId: true,
        tipo: true,
        peso: true,
        padraoCor: true,
        cauda: true,
        caracteristica: true,
        origem: true,
        temperatura: true,
        ph: true,
        alimentacao: true,
        expectativaVida: true,
        category: { select: { nome: true, slug: true } },
        videos: {
          where: { ativo: true }, // loja mostra só vídeos ativos
          orderBy: [{ principal: "desc" }, { ordem: "asc" }],
          select: {
            id: true,
            platform: true,
            videoId: true,
            thumbnailUrl: true,
            originalUrl: true,
            titulo: true,
            principal: true,
          },
        },
        variantes: {
          where: { ativo: true },
          orderBy: [{ padrao: "desc" }, { ordem: "asc" }],
          select: {
            id: true,
            composicao: true,
            preco: true,
            qtdMachos: true,
            qtdFemeas: true,
            rotulo: true,
            padrao: true,
          },
        },
      },
    });
    if (!p) return null;

    return {
      id: p.id,
      nome: p.nome,
      slug: p.slug,
      descricao: p.descricao,
      descricaoCurta: p.descricaoCurta,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      preco: Number(p.preco),
      descontoPix: p.descontoPix == null ? null : Number(p.descontoPix),
      usarDescontoPixGlobal: p.usarDescontoPixGlobal,
      parcelasMax: p.parcelasMax,
      estoque: p.estoque,
      estoqueMachos: p.estoqueMachos,
      estoqueFemeas: p.estoqueFemeas,
      categoria: p.category.nome,
      categoriaSlug: p.category.slug,
      categoryId: p.categoryId,
      tipo: p.tipo,
      peso: p.peso == null ? null : Number(p.peso),
      padraoCor: p.padraoCor,
      cauda: p.cauda,
      caracteristica: p.caracteristica,
      origem: p.origem,
      temperatura: p.temperatura,
      ph: p.ph,
      alimentacao: p.alimentacao,
      expectativaVida: p.expectativaVida,
      videos: p.videos,
      variantes: p.variantes.map((v) => ({
        id: v.id,
        composicao: v.composicao,
        preco: Number(v.preco),
        qtdMachos: v.qtdMachos,
        qtdFemeas: v.qtdFemeas,
        rotulo: v.rotulo,
        padrao: v.padrao,
      })),
    };
  },
);

// Card enxuto do grid "Principais linhagens" do guia (/peixe-guppy).
export type LinhagemGuiaCard = {
  slug: string;
  nome: string;
  descricaoCurta: string | null;
  thumb: string | null;
};

/**
 * Produtos ativos da categoria de linhagens para o grid do guia. Destaques
 * primeiro. Só o necessário para o card (slug, nome, descrição curta, thumb).
 * O slug da categoria é o real do banco; se mudar, o grid apenas fica vazio
 * (nunca linka para algo que não existe).
 */
export async function getLinhagensParaGuia(take = 6): Promise<LinhagemGuiaCard[]> {
  const rows = await prisma.product.findMany({
    where: { ativo: true, category: { slug: "linhagens-exclusivas" } },
    orderBy: [{ destaque: "desc" }, { criadoEm: "desc" }],
    take,
    select: {
      slug: true,
      nome: true,
      descricaoCurta: true,
      videos: {
        where: { ativo: true },
        orderBy: [{ principal: "desc" }, { ordem: "asc" }],
        take: 1,
        select: { thumbnailUrl: true },
      },
    },
  });
  return rows.map((r) => ({
    slug: r.slug,
    nome: r.nome,
    descricaoCurta: r.descricaoCurta,
    thumb: r.videos[0]?.thumbnailUrl ?? null,
  }));
}

/**
 * Produtos ativos para o sitemap: só slug + atualizadoEm (lastModified). Ordena
 * por atualização recente. Query enxuta — não carrega vídeos/variantes.
 */
export function getActiveProductsForSitemap(): Promise<
  { slug: string; atualizadoEm: Date }[]
> {
  return prisma.product.findMany({
    where: { ativo: true },
    orderBy: { atualizadoEm: "desc" },
    select: { slug: true, atualizadoEm: true },
  });
}

// ── Lista do admin (/admin/produtos): busca + categoria + ordenação ──────────
export type ProdutoOrdem =
  | "recentes"
  | "preco-asc"
  | "preco-desc"
  | "estoque-asc"
  | "estoque-desc";

// Tie-break por id mantém ordem estável quando há preços/estoques iguais.
const produtoOrderBy: Record<ProdutoOrdem, Prisma.ProductOrderByWithRelationInput[]> = {
  recentes: [{ criadoEm: "desc" }, { id: "asc" }],
  "preco-asc": [{ preco: "asc" }, { id: "asc" }],
  "preco-desc": [{ preco: "desc" }, { id: "asc" }],
  "estoque-asc": [{ estoque: "asc" }, { id: "asc" }],
  "estoque-desc": [{ estoque: "desc" }, { id: "asc" }],
};

export async function listProducts(
  args: { q?: string; categoriaSlug?: string; ordem?: ProdutoOrdem } = {},
) {
  const where: Prisma.ProductWhereInput = {};
  const termo = args.q?.trim();
  if (termo) {
    where.OR = [
      { nome: { contains: termo, mode: "insensitive" } },
      { padraoCor: { contains: termo, mode: "insensitive" } },
    ];
  }
  if (args.categoriaSlug && args.categoriaSlug !== "todos") {
    where.category = { slug: args.categoriaSlug };
  }

  const rows = await prisma.product.findMany({
    where,
    orderBy: produtoOrderBy[args.ordem ?? "recentes"],
    include: {
      category: { select: { nome: true, slug: true } },
      // Vídeo principal (capa) para a thumbnail da listagem.
      videos: {
        where: { principal: true },
        take: 1,
        select: { thumbnailUrl: true, platform: true },
      },
      // Chips de composição: variantes ativas (padrão primeiro).
      variantes: {
        where: { ativo: true },
        orderBy: [{ padrao: "desc" }, { ordem: "asc" }],
        select: { composicao: true, padrao: true },
      },
      _count: {
        select: { imagens: true, videos: true, orderItems: true, waitlist: true },
      },
    },
  });

  // Decimal → number (preço/desconto). Estoque/preço exibidos vêm do Product.
  return rows.map((p) => ({
    ...p,
    preco: Number(p.preco),
    descontoPix: p.descontoPix == null ? null : Number(p.descontoPix),
  }));
}

export type ProdutoListItem = Awaited<ReturnType<typeof listProducts>>[number];

/**
 * Busca um produto para edição. Converte os campos Decimal para number antes de
 * retornar — Decimal (Prisma) não serializa direto para Client Component.
 */
export async function getProductById(id: string) {
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      // Principal primeiro, depois pela ordem dos adicionais.
      videos: { orderBy: [{ principal: "desc" }, { ordem: "asc" }] },
      variantes: { orderBy: [{ padrao: "desc" }, { ordem: "asc" }] },
    },
  });
  if (!p) return null;

  return {
    ...p,
    preco: Number(p.preco),
    descontoPix: p.descontoPix == null ? null : Number(p.descontoPix),
    peso: p.peso == null ? null : Number(p.peso),
    comprimento: p.comprimento == null ? null : Number(p.comprimento),
    largura: p.largura == null ? null : Number(p.largura),
    altura: p.altura == null ? null : Number(p.altura),
    variantes: p.variantes.map((v) => ({
      composicao: v.composicao,
      preco: Number(v.preco),
      qtdMachos: v.qtdMachos,
      qtdFemeas: v.qtdFemeas,
      rotulo: v.rotulo,
      padrao: v.padrao,
      ativo: v.ativo,
    })),
  };
}

/** Dados auxiliares para o formulário de produto (popula o <select> de categoria). */
export async function getProductFormData() {
  const categorias = await prisma.category.findMany({
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true },
  });
  return { categorias };
}

// ── Feed de vídeo (Leva B) ─────────────────────────────────────
// Todos os produtos ATIVOS que têm ao menos um vídeo ativo, com destaques
// primeiro. Traz variantes (composição) + pool de estoque + insumos de preço +
// os vídeos ativos ordenados (principal → ordem). Decimais → number.
export type FeedVideo = {
  platform: "YOUTUBE" | "INSTAGRAM" | "TIKTOK";
  videoId: string | null;
  originalUrl: string;
  thumbnailUrl: string | null;
  titulo: string | null;
};

export type FeedVariante = {
  id: string;
  composicao: TipoComposicao;
  preco: number;
  qtdMachos: number;
  qtdFemeas: number;
  rotulo: string | null;
  padrao: boolean;
};

export type FeedProduto = {
  id: string;
  nome: string;
  slug: string;
  preco: number;
  descontoPix: number | null;
  usarDescontoPixGlobal: boolean;
  parcelasMax: number;
  estoque: number;
  estoqueMachos: number;
  estoqueFemeas: number;
  campanha: CampanhaInfo | null;
  variantes: FeedVariante[];
  videos: FeedVideo[];
};

export async function getVideoFeed(): Promise<FeedProduto[]> {
  const [rows, config] = await Promise.all([
    prisma.product.findMany({
      where: { ativo: true, videos: { some: { ativo: true } } },
      // Destaques primeiro; depois recentes. Tie-break por id (ordem estável).
      // (A reordenação final que joga esgotados pro fim é em memória, abaixo.)
      orderBy: [{ destaque: "desc" }, { criadoEm: "desc" }, { id: "asc" }],
      select: {
        id: true,
        nome: true,
        slug: true,
        preco: true,
        descontoPix: true,
        usarDescontoPixGlobal: true,
        parcelasMax: true,
        estoque: true,
        estoqueMachos: true,
        estoqueFemeas: true,
        categoryId: true, // escopo de campanha
        destaque: true, // p/ ordenarVitrine (destaque entre disponíveis)
        variantes: {
          where: { ativo: true },
          orderBy: [{ padrao: "desc" }, { ordem: "asc" }],
          select: {
            id: true,
            composicao: true,
            preco: true,
            qtdMachos: true,
            qtdFemeas: true,
            rotulo: true,
            padrao: true,
          },
        },
        videos: {
          where: { ativo: true },
          orderBy: [{ principal: "desc" }, { ordem: "asc" }],
          select: {
            platform: true,
            videoId: true,
            originalUrl: true,
            thumbnailUrl: true,
            titulo: true,
          },
        },
      },
    }),
    getConfigPreco(),
  ]);

  // Campanha vigente por produto (mesma resolução da vitrine). O card aplica o
  // preço promocional por variante com precoComCampanha.
  const campMap = await resolverCampanhas(
    rows.map((r) => {
      const precos = calcularPrecos(
        {
          precoBase: Number(r.preco),
          descontoPixProprio: r.descontoPix == null ? null : Number(r.descontoPix),
          usarDescontoPixGlobal: r.usarDescontoPixGlobal,
        },
        config,
      );
      return {
        id: r.id,
        categoryId: r.categoryId,
        precoCheio: precos.precoCartao,
        descontoPixPercent: precos.descontoPixPercent,
        estoqueMachos: r.estoqueMachos,
        estoqueFemeas: r.estoqueFemeas,
      };
    }),
  );

  // Esgotados (pool 0/0) por último; destaque só conta entre disponíveis.
  return ordenarVitrine(rows).map((p) => {
    const camp = campMap.get(p.id);
    return {
      id: p.id,
      nome: p.nome,
      slug: p.slug,
      preco: Number(p.preco),
      descontoPix: p.descontoPix == null ? null : Number(p.descontoPix),
      usarDescontoPixGlobal: p.usarDescontoPixGlobal,
      parcelasMax: p.parcelasMax,
      estoque: p.estoque,
      estoqueMachos: p.estoqueMachos,
      estoqueFemeas: p.estoqueFemeas,
      campanha: camp
        ? {
            cupomId: camp.cupomId,
            codigo: camp.codigo,
            tipoValor: camp.tipoValor,
            valor: camp.valor,
            precoUnico: camp.precoUnico,
          }
        : null,
      variantes: p.variantes.map((v) => ({
        id: v.id,
        composicao: v.composicao,
        preco: Number(v.preco),
        qtdMachos: v.qtdMachos,
        qtdFemeas: v.qtdFemeas,
        rotulo: v.rotulo,
        padrao: v.padrao,
      })),
      videos: p.videos,
    };
  });
}
