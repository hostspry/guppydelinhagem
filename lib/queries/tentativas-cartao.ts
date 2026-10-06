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
  fluxo: string | null;
  criadoEm: Date;
};

export type PainelTentativasCartao = {
  linhas: TentativaCartaoLinha[];
  /** Quantas de cada etapa nos últimos 30 dias (rótulo dos filtros). */
  contagem: Record<string, number>;
  total: number;
  /** Funil dos últimos 30 dias: do formulário aberto até o cartão aprovado. */
  funil: {
    abertos: number;
    envios: number;
    barrados: number;
    recusados: number;
    aprovados: number;
  };
};

// Abertura e clique em Pagar são funil, não falha: ficam fora da lista.
const FUNIL: EtapaCartao[] = ["ABERTO", "ENVIO"];

export async function listarTentativasCartao(
  etapa?: EtapaCartao,
  take = 100,
): Promise<PainelTentativasCartao> {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [linhas, porEtapa, aprovados] = await Promise.all([
    prisma.tentativaCartao.findMany({
      where: etapa ? { etapa } : { etapa: { notIn: FUNIL } },
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
        fluxo: true,
        criadoEm: true,
      },
    }),
    prisma.tentativaCartao.groupBy({
      by: ["etapa"],
      where: { criadoEm: { gte: desde } },
      _count: { _all: true },
    }),
    prisma.pagamento.count({
      where: {
        metodo: "CARTAO",
        status: { in: ["PAGO", "ESTORNADO"] },
        criadoEm: { gte: desde },
      },
    }),
  ]);

  const contagem: Record<string, number> = {};
  let total = 0;
  for (const g of porEtapa) {
    contagem[g.etapa] = g._count._all;
    if (!FUNIL.includes(g.etapa)) total += g._count._all;
  }

  return {
    linhas: linhas.map((l) => ({
      ...l,
      valor: l.valor == null ? null : Number(l.valor),
    })),
    contagem,
    total,
    funil: {
      abertos: contagem.ABERTO ?? 0,
      envios: contagem.ENVIO ?? 0,
      barrados:
        (contagem.VALIDACAO ?? 0) +
        (contagem.FORMULARIO ?? 0) +
        (contagem.SDK ?? 0) +
        (contagem.COBRANCA ?? 0),
      recusados: contagem.RECUSA ?? 0,
      aprovados,
    },
  };
}
