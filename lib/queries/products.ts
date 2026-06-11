import { prisma } from "../prisma";

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
