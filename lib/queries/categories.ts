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
