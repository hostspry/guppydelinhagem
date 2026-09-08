import { prisma } from "../prisma";

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { ordem: "asc" },
    include: {
      _count: { select: { produtos: true } },
    },
  });
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { produtos: true } } },
  });
}

export async function getNextOrdem() {
  const last = await prisma.category.findFirst({
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });
  return (last?.ordem ?? -1) + 1;
}

/**
 * Categorias que o SITE pode mostrar: só as que têm ao menos um produto ativo.
 *
 * Categoria vazia não vira filtro nem item de menu — o cliente não deve clicar
 * em "Filtros e bombas" e cair numa vitrine sem nada. A categoria segue existindo
 * no admin (listCategories) para o dono cadastrar em paz antes de publicar; ela
 * aparece sozinha assim que o primeiro produto ativo entrar.
 */
export async function listCategoriasPublicas() {
  return prisma.category.findMany({
    where: { produtos: { some: { ativo: true } } },
    orderBy: { ordem: "asc" },
    select: { id: true, slug: true, nome: true },
  });
}
