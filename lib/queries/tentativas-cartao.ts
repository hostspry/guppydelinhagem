import "server-only";
import { prisma } from "@/lib/prisma";
import type { EtapaCartao } from "@/lib/generated/prisma/enums";

// Leitura das tentativas de cartão frustradas (lib/pagamento-tentativas grava).
// Fica aqui, e não na página, porque a data de corte é impura e a página é um
// Server Component — a mesma divisão das outras telas do painel.

export type TentativaCartaoLinha = {
  id: string;
  etapa: EtapaCartao;
  mensagem: string;
  statusDetail: string | null;
  valor: number | null;
  parcelas: number | null;
  deviceOk: boolean;
  numero: string | null;
  email: string | null;
  telefone: string | null;
  criadoEm: Date;
};

export type PainelTentativasCartao = {
  linhas: TentativaCartaoLinha[];
  /** Quantas de cada etapa nos últimos 30 dias (rótulo dos filtros). */
  contagem: Record<string, number>;
  total: number;
};

export async function listarTentativasCartao(
  etapa?: EtapaCartao,
  take = 100,
): Promise<PainelTentativasCartao> {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [linhas, porEtapa] = await Promise.all([
    prisma.tentativaCartao.findMany({
      where: etapa ? { etapa } : {},
      orderBy: { criadoEm: "desc" },
      take,
      select: {
        id: true,
        etapa: true,
        mensagem: true,
        statusDetail: true,
        valor: true,
        parcelas: true,
        deviceOk: true,
        numero: true,
        email: true,
        telefone: true,
        criadoEm: true,
      },
    }),
    prisma.tentativaCartao.groupBy({
      by: ["etapa"],
      where: { criadoEm: { gte: desde } },
      _count: { _all: true },
    }),
  ]);

  const contagem: Record<string, number> = {};
  let total = 0;
  for (const g of porEtapa) {
    contagem[g.etapa] = g._count._all;
    total += g._count._all;
  }

  return {
    linhas: linhas.map((l) => ({
      ...l,
      valor: l.valor == null ? null : Number(l.valor),
    })),
    contagem,
    total,
  };
}
