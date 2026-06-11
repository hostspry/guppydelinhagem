import { prisma } from "../prisma";
import type { Prisma } from "../generated/prisma/client";

// ─────────────────────────────────────────────────────────────
// Queries públicas (loja) — só produtos ativos. Decimais convertidos para
// number (Decimal do Prisma não serializa para Client Components).
// ─────────────────────────────────────────────────────────────

export type PublicProductCard = {
  id: string;
  nome: string;
  slug: string;
  preco: number;
  descontoPix: number | null;
  parcelasMax: number;
  estoque: number;
  video: {
    platform: "YOUTUBE" | "INSTAGRAM" | "TIKTOK";
    thumbnailUrl: string | null;
  } | null;
};

const cardSelect = {
  id: true,
  nome: true,
  slug: true,
  preco: true,
  descontoPix: true,
  parcelasMax: true,
  estoque: true,
  // Vídeo de capa: principal primeiro, senão o de menor ordem.
  videos: {
    orderBy: [{ principal: "desc" }, { ordem: "asc" }],
    take: 1,
    select: { platform: true, thumbnailUrl: true },
  },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function toCard(p: CardRow): PublicProductCard {
  const v = p.videos[0];
  return {
    id: p.id,
    nome: p.nome,
    slug: p.slug,
    preco: Number(p.preco),
    descontoPix: p.descontoPix == null ? null : Number(p.descontoPix),
    parcelasMax: p.parcelasMax,
    estoque: p.estoque,
    video: v ? { platform: v.platform, thumbnailUrl: v.thumbnailUrl } : null,
  };
}

async function findCards(
  where: Prisma.ProductWhereInput,
  take = 4,
): Promise<PublicProductCard[]> {
  const rows = await prisma.product.findMany({
    where,
    orderBy: { criadoEm: "desc" },
    take,
    select: cardSelect,
  });
  return rows.map(toCard);
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

export async function listProducts() {
  return prisma.product.findMany({
    orderBy: { criadoEm: "desc" },
    include: {
      category: { select: { nome: true } },
      // Vídeo principal (capa) para a thumbnail da listagem.
      videos: {
        where: { principal: true },
        take: 1,
        select: { thumbnailUrl: true, platform: true },
      },
      _count: {
        select: { imagens: true, videos: true, orderItems: true, waitlist: true },
      },
    },
  });
}

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
