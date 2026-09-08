import { prisma } from "../prisma";
import { ehPermissao, type Permissao } from "@/lib/permissoes";
import type { SegmentoFinanceiro } from "@/lib/generated/prisma/enums";

export type CargoItem = {
  id: string;
  nome: string;
  descricao: string | null;
  permissoes: Permissao[];
  segmentosFinanceiros: SegmentoFinanceiro[];
  protegido: boolean;
  ordem: number;
  /** Quantas pessoas usam este cargo — a tela avisa antes de excluir. */
  pessoas: number;
};

const SELECT = {
  id: true,
  nome: true,
  descricao: true,
  permissoes: true,
  segmentosFinanceiros: true,
  protegido: true,
  ordem: true,
  _count: { select: { usuarios: true } },
} as const;

type Row = {
  id: string;
  nome: string;
  descricao: string | null;
  permissoes: string[];
  segmentosFinanceiros: SegmentoFinanceiro[];
  protegido: boolean;
  ordem: number;
  _count: { usuarios: number };
};

// O banco guarda permissão como texto; aqui filtramos o que o código conhece.
// Permissão que deixou de existir (renomeada num deploy) some sozinha em vez de
// vazar uma string estranha para a tela.
function paraItem(c: Row): CargoItem {
  return {
    id: c.id,
    nome: c.nome,
    descricao: c.descricao,
    permissoes: c.permissoes.filter(ehPermissao),
    segmentosFinanceiros: c.segmentosFinanceiros,
    protegido: c.protegido,
    ordem: c.ordem,
    pessoas: c._count.usuarios,
  };
}

export async function listarCargos(): Promise<CargoItem[]> {
  const cargos = await prisma.cargo.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: SELECT,
  });
  return cargos.map((c) => paraItem(c as Row));
}

export async function getCargo(id: string): Promise<CargoItem | null> {
  const c = await prisma.cargo.findUnique({ where: { id }, select: SELECT });
  return c ? paraItem(c as Row) : null;
}

/** Lista enxuta para o <select> do formulário de membro. */
export async function cargosParaFormulario(): Promise<
  { id: string; nome: string; descricao: string | null }[]
> {
  return prisma.cargo.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, descricao: true },
  });
}
