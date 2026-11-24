import "server-only";
import { prisma } from "@/lib/prisma";
import {
  filtroSegmento,
  membroAtual,
  segmentosPermitidos,
} from "@/lib/permissoes-server";
import { ehDono } from "@/lib/permissoes";
import { montarFechamento, type Fechamento } from "@/lib/financeiro/fechamento";
import { intervaloDaCompetencia } from "@/lib/financeiro/periodo";

/**
 * Busca o caixa confirmado do mês e monta o fechamento. O filtro de segmento
 * entra no `where`: quem só vê a estufa não recebe nenhuma linha de produtos,
 * nem para somar. As retiradas privadas do Lucas seguem a mesma ideia: só são
 * lidas do banco quando quem está logado é o dono.
 */
export async function fechamentoDoMes(competencia: string): Promise<Fechamento> {
  const { inicio, fim } = intervaloDaCompetencia(competencia);
  const [escopo, segmentos, membro] = await Promise.all([
    filtroSegmento(),
    segmentosPermitidos(),
    membroAtual(),
  ]);

  const retiradasPrivadas = ehDono(membro)
    ? await prisma.retiradaPrivadaLucas.findMany({
        where: { data: { gte: inicio, lt: fim } },
        orderBy: { data: "asc" },
        select: { descricao: true, valor: true, data: true },
      })
    : [];

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
    retiradasPrivadasLucas: retiradasPrivadas.map((r) => ({
      descricao: r.descricao,
      valor: Number(r.valor),
      data: r.data,
    })),
    linhas: linhas.map((l) => ({
      segmento: l.segmento,
      tipo: l.tipo as "ENTRADA" | "SAIDA",
      valor: Number(l.valor),
      data: l.data,
      categoriaSlug: l.categoria?.slug ?? null,
    })),
  });
}
