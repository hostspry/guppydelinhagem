import { prisma } from "@/lib/prisma";

export type AuditoriaItem = {
  id: string;
  userNome: string;
  userEmail: string;
  userPapel: string;
  acao: string;
  area: string;
  entidade: string | null;
  entidadeId: string | null;
  descricao: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
  ip: string | null;
  ocorridoEm: Date;
};

export type FiltroAuditoria = {
  membroId?: string;
  area?: string;
  busca?: string;
  pagina?: number;
};

const POR_PAGINA = 50;

/** "produto.atualizar" → "produto". Serve para o filtro por área. */
function areaDa(acao: string): string {
  return acao.split(".")[0] ?? acao;
}

export async function listarAuditoria(filtro: FiltroAuditoria = {}): Promise<{
  itens: AuditoriaItem[];
  total: number;
  pagina: number;
  paginas: number;
}> {
  const pagina = Math.max(1, filtro.pagina ?? 1);

  const where = {
    ...(filtro.membroId ? { userId: filtro.membroId } : {}),
    ...(filtro.area ? { acao: { startsWith: `${filtro.area}.` } } : {}),
    ...(filtro.busca
      ? {
          OR: [
            { descricao: { contains: filtro.busca, mode: "insensitive" as const } },
            { userNome: { contains: filtro.busca, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [linhas, total] = await Promise.all([
    prisma.auditoriaAdmin.findMany({
      where,
      orderBy: { ocorridoEm: "desc" },
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
    }),
    prisma.auditoriaAdmin.count({ where }),
  ]);

  return {
    itens: linhas.map((l) => ({
      id: l.id,
      userNome: l.userNome,
      userEmail: l.userEmail,
      userPapel: l.userPapel,
      acao: l.acao,
      area: areaDa(l.acao),
      entidade: l.entidade,
      entidadeId: l.entidadeId,
      descricao: l.descricao,
      antes: (l.antes as Record<string, unknown> | null) ?? null,
      depois: (l.depois as Record<string, unknown> | null) ?? null,
      ip: l.ip,
      ocorridoEm: l.ocorridoEm,
    })),
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  };
}

/** Quem aparece no histórico — alimenta o filtro por pessoa. */
export async function membrosComRegistro(): Promise<
  { id: string; nome: string }[]
> {
  const linhas = await prisma.auditoriaAdmin.groupBy({
    by: ["userId", "userNome"],
    _count: { _all: true },
    orderBy: { _count: { userId: "desc" } },
    take: 30,
  });
  return linhas
    .filter((l): l is typeof l & { userId: string } => l.userId !== null)
    .map((l) => ({ id: l.userId, nome: l.userNome }));
}

/** Áreas presentes no histórico (produto, pedido, financeiro…). */
export async function areasComRegistro(): Promise<string[]> {
  const linhas = await prisma.auditoriaAdmin.findMany({
    select: { acao: true },
    distinct: ["acao"],
    take: 200,
  });
  return [...new Set(linhas.map((l) => areaDa(l.acao)))].sort();
}
