import { prisma } from "@/lib/prisma";
import { ehPapelEquipe, type PapelEquipe } from "@/lib/permissoes";

export type MembroListItem = {
  id: string;
  nome: string;
  email: string;
  role: PapelEquipe;
  limiteDescontoPercent: number | null;
  podeCancelarPedido: boolean;
  podeEstornar: boolean;
  limiteValorFinanceiro: number | null;
  senhaPrecisaTroca: boolean;
  temSenha: boolean;
  ultimoLogin: Date | null;
  criadoEm: Date;
};

const SELECT = {
  id: true,
  nome: true,
  email: true,
  role: true,
  limiteDescontoPercent: true,
  podeCancelarPedido: true,
  podeEstornar: true,
  limiteValorFinanceiro: true,
  senhaPrecisaTroca: true,
  senhaHash: true,
  ultimoLogin: true,
  criadoEm: true,
} as const;

type Row = {
  id: string;
  nome: string;
  email: string;
  role: string;
  limiteDescontoPercent: number | null;
  podeCancelarPedido: boolean;
  podeEstornar: boolean;
  limiteValorFinanceiro: unknown;
  senhaPrecisaTroca: boolean;
  senhaHash: string | null;
  ultimoLogin: Date | null;
  criadoEm: Date;
};

function paraItem(u: Row): MembroListItem | null {
  if (!ehPapelEquipe(u.role)) return null;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    limiteDescontoPercent: u.limiteDescontoPercent,
    podeCancelarPedido: u.podeCancelarPedido,
    podeEstornar: u.podeEstornar,
    limiteValorFinanceiro:
      u.limiteValorFinanceiro == null ? null : Number(u.limiteValorFinanceiro),
    senhaPrecisaTroca: u.senhaPrecisaTroca,
    // O hash nunca sai daqui — a lista só precisa saber se existe senha.
    temSenha: u.senhaHash != null,
    ultimoLogin: u.ultimoLogin,
    criadoEm: u.criadoEm,
  };
}

/** Equipe = todo mundo que não é CUSTOMER. Dono primeiro, depois por entrada. */
export async function listMembros(): Promise<MembroListItem[]> {
  const users = await prisma.user.findMany({
    where: { NOT: { role: "CUSTOMER" } },
    select: SELECT,
    orderBy: [{ role: "asc" }, { criadoEm: "asc" }],
  });
  return users.map(paraItem).filter((m): m is MembroListItem => m !== null);
}

export async function getMembro(id: string): Promise<MembroListItem | null> {
  const u = await prisma.user.findUnique({ where: { id }, select: SELECT });
  return u ? paraItem(u) : null;
}
