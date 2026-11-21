import "server-only";
import { prisma } from "@/lib/prisma";
import { filtroSegmento, segmentosPermitidos } from "@/lib/permissoes-server";
import { montarFechamento, type Fechamento } from "@/lib/financeiro/fechamento";
import { intervaloDaCompetencia } from "@/lib/financeiro/periodo";

/**
 * Busca o caixa confirmado do mês e monta o fechamento. O filtro de segmento
 * entra no `where`: quem só vê a estufa não recebe nenhuma linha de produtos,
 * nem para somar.
 */
export async function fechamentoDoMes(competencia: string): Promise<Fechamento> {
  const { inicio, fim } = intervaloDaCompetencia(competencia);
  const [escopo, segmentos] = await Promise.all([
    filtroSegmento(),
    segmentosPermitidos(),
  ]);

  const linhas = await prisma.lancamento.findMany({
    where: { ...escopo, status: "CONFIRMADO", data: { gte: inicio, lt: fim } },
    select: {
      segmento: true,
      tipo: true,
      valor: true,
      data: true,
      categoria: { select: { slug: true } },
    },
  });

  return montarFechamento({
    competencia,
    segmentos,
    linhas: linhas.map((l) => ({
      segmento: l.segmento,
      tipo: l.tipo as "ENTRADA" | "SAIDA",
      valor: Number(l.valor),
      data: l.data,
      categoriaSlug: l.categoria?.slug ?? null,
    })),
  });
}
