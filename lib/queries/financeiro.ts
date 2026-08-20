import { prisma } from "@/lib/prisma";
import { intervaloDaCompetencia } from "@/lib/financeiro/periodo";

/**
 * Consultas do caixa. Regime de CAIXA: só lançamento CONFIRMADO entra nas somas.
 * PENDENTE (venda a conferir, conta a vencer) aparece à parte, para o dono saber
 * o que está por vir sem que isso infle o saldo do mês.
 */

export type LancamentoItem = {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  status: "PENDENTE" | "CONFIRMADO" | "DESCARTADO";
  origem: string;
  descricao: string;
  valor: number;
  data: Date;
  vencimento: Date | null;
  categoriaNome: string | null;
  categoriaId: string | null;
  comprovanteUrl: string | null;
  observacoes: string | null;
  orderId: string | null;
  orderNumero: string | null;
  criadoPorNome: string | null;
  canal: string | null; // marcação de venda (só entrada)
  campanha: string | null;
};

const SELECT = {
  id: true,
  tipo: true,
  status: true,
  origem: true,
  descricao: true,
  valor: true,
  data: true,
  vencimento: true,
  categoriaId: true,
  categoria: { select: { nome: true } },
  comprovanteUrl: true,
  observacoes: true,
  orderId: true,
  order: { select: { numero: true } },
  criadoPor: { select: { nome: true } },
  canal: true,
  campanha: true,
} as const;

type Row = {
  id: string;
  tipo: string;
  status: string;
  origem: string;
  descricao: string;
  valor: unknown;
  data: Date;
  vencimento: Date | null;
  categoriaId: string | null;
  categoria: { nome: string } | null;
  comprovanteUrl: string | null;
  observacoes: string | null;
  orderId: string | null;
  order: { numero: string } | null;
  criadoPor: { nome: string } | null;
  canal: string | null;
  campanha: string | null;
};

function paraItem(l: Row): LancamentoItem {
  return {
    id: l.id,
    tipo: l.tipo as LancamentoItem["tipo"],
    status: l.status as LancamentoItem["status"],
    origem: l.origem,
    descricao: l.descricao,
    valor: Number(l.valor),
    data: l.data,
    vencimento: l.vencimento,
    categoriaNome: l.categoria?.nome ?? null,
    categoriaId: l.categoriaId,
    comprovanteUrl: l.comprovanteUrl,
    observacoes: l.observacoes,
    orderId: l.orderId,
    orderNumero: l.order?.numero ?? null,
    criadoPorNome: l.criadoPor?.nome ?? null,
    canal: l.canal,
    campanha: l.campanha,
  };
}

export type ResumoMensal = {
  competencia: string;
  entradas: number;
  saidas: number;
  saldo: number;
  /** Saldo de todos os meses até o fim deste — o dinheiro que sobrou no total. */
  saldoAcumulado: number;
  lancamentos: LancamentoItem[];
  porCategoria: {
    categoriaId: string | null;
    nome: string;
    tipo: "ENTRADA" | "SAIDA";
    total: number;
  }[];
};

/** Soma de confirmados no intervalo, separada por tipo. */
async function somarPorTipo(inicio: Date, fim?: Date) {
  const linhas = await prisma.lancamento.groupBy({
    by: ["tipo"],
    where: {
      status: "CONFIRMADO",
      data: fim ? { gte: inicio, lt: fim } : { lt: inicio },
    },
    _sum: { valor: true },
  });
  let entradas = 0;
  let saidas = 0;
  for (const l of linhas) {
    const v = Number(l._sum.valor ?? 0);
    if (l.tipo === "ENTRADA") entradas = v;
    else saidas = v;
  }
  return { entradas, saidas };
}

export async function resumoMensal(competencia: string): Promise<ResumoMensal> {
  const { inicio, fim } = intervaloDaCompetencia(competencia);

  const [doMes, ateOFim, lancamentos, agrupado, categorias] = await Promise.all([
    somarPorTipo(inicio, fim),
    // Acumulado: tudo que foi confirmado até o fim deste mês (inclusive).
    somarPorTipo(fim),
    prisma.lancamento.findMany({
      where: { status: { not: "DESCARTADO" }, data: { gte: inicio, lt: fim } },
      select: SELECT,
      orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
    }),
    prisma.lancamento.groupBy({
      by: ["categoriaId", "tipo"],
      where: { status: "CONFIRMADO", data: { gte: inicio, lt: fim } },
      _sum: { valor: true },
    }),
    prisma.categoriaFinanceira.findMany({ select: { id: true, nome: true } }),
  ]);

  const nomePorId = new Map(categorias.map((c) => [c.id, c.nome]));

  return {
    competencia,
    entradas: doMes.entradas,
    saidas: doMes.saidas,
    saldo: doMes.entradas - doMes.saidas,
    saldoAcumulado: ateOFim.entradas - ateOFim.saidas,
    lancamentos: lancamentos.map((l) => paraItem(l as Row)),
    porCategoria: agrupado
      .map((g) => ({
        categoriaId: g.categoriaId,
        nome: g.categoriaId
          ? (nomePorId.get(g.categoriaId) ?? "Categoria removida")
          : "Sem categoria",
        tipo: g.tipo as "ENTRADA" | "SAIDA",
        total: Number(g._sum.valor ?? 0),
      }))
      .sort((a, b) => b.total - a.total),
  };
}

/** Vendas do site esperando conferência (as sugestões automáticas). */
export async function listarSugestoesDeVenda(): Promise<LancamentoItem[]> {
  const linhas = await prisma.lancamento.findMany({
    where: { status: "PENDENTE", origem: "PEDIDO" },
    select: SELECT,
    orderBy: { data: "desc" },
  });
  return linhas.map((l) => paraItem(l as Row));
}

/** Contas a pagar/receber ainda não quitadas, da mais vencida para a mais longe. */
export async function listarContasEmAberto(): Promise<LancamentoItem[]> {
  const linhas = await prisma.lancamento.findMany({
    where: { status: "PENDENTE", origem: { not: "PEDIDO" } },
    select: SELECT,
    orderBy: [{ vencimento: "asc" }, { data: "asc" }],
  });
  return linhas.map((l) => paraItem(l as Row));
}

export type ContadoresPendencia = {
  sugestoes: number;
  contasAbertas: number;
  vencidas: number;
  venceEm7Dias: number;
};

/** Números para o alerta no topo do caixa e o selo na navegação. */
export async function contadoresPendencia(): Promise<ContadoresPendencia> {
  const hoje = new Date();
  const em7 = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [sugestoes, contasAbertas, vencidas, venceEm7Dias] = await Promise.all([
    prisma.lancamento.count({ where: { status: "PENDENTE", origem: "PEDIDO" } }),
    prisma.lancamento.count({
      where: { status: "PENDENTE", origem: { not: "PEDIDO" } },
    }),
    prisma.lancamento.count({
      where: {
        status: "PENDENTE",
        origem: { not: "PEDIDO" },
        vencimento: { lt: hoje },
      },
    }),
    prisma.lancamento.count({
      where: {
        status: "PENDENTE",
        origem: { not: "PEDIDO" },
        vencimento: { gte: hoje, lte: em7 },
      },
    }),
  ]);

  return { sugestoes, contasAbertas, vencidas, venceEm7Dias };
}

export async function getLancamento(id: string): Promise<LancamentoItem | null> {
  const l = await prisma.lancamento.findUnique({ where: { id }, select: SELECT });
  return l ? paraItem(l as Row) : null;
}

export type CategoriaItem = {
  id: string;
  nome: string;
  slug: string;
  tipo: "ENTRADA" | "SAIDA" | null;
  sistema: boolean;
  ativa: boolean;
  usos: number;
};

export async function listarCategorias(): Promise<CategoriaItem[]> {
  const cats = await prisma.categoriaFinanceira.findMany({
    orderBy: [{ tipo: "asc" }, { ordem: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      slug: true,
      tipo: true,
      sistema: true,
      ativa: true,
      _count: { select: { lancamentos: true } },
    },
  });
  return cats.map((c) => ({
    id: c.id,
    nome: c.nome,
    slug: c.slug,
    tipo: c.tipo as CategoriaItem["tipo"],
    sistema: c.sistema,
    ativa: c.ativa,
    usos: c._count.lancamentos,
  }));
}

/** Só as ativas, para os <select> dos formulários. */
export async function categoriasParaFormulario(): Promise<
  { id: string; nome: string; tipo: "ENTRADA" | "SAIDA" | null; slug: string }[]
> {
  const cats = await prisma.categoriaFinanceira.findMany({
    where: { ativa: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, tipo: true, slug: true },
  });
  return cats.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo as "ENTRADA" | "SAIDA" | null,
    slug: c.slug,
  }));
}

/**
 * Campanhas já usadas em lançamentos, para sugerir no formulário. Campanha é
 * texto livre (cada uma tem nome próprio), e sugerir o que já existe é o que
 * evita "Black Friday", "black friday" e "BlackFriday" virarem três coisas.
 */
export async function campanhasUsadas(): Promise<string[]> {
  const linhas = await prisma.lancamento.findMany({
    where: { campanha: { not: null } },
    distinct: ["campanha"],
    orderBy: { data: "desc" },
    take: 40,
    select: { campanha: true },
  });
  return linhas
    .map((l) => l.campanha)
    .filter((c): c is string => !!c && c.trim() !== "");
}

export type RecorrenciaItem = {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  valor: number;
  diaVencimento: number;
  ativa: boolean;
  categoriaId: string | null;
  categoriaNome: string | null;
  ultimaCompetencia: string | null;
  observacoes: string | null;
};

export async function listarRecorrencias(): Promise<RecorrenciaItem[]> {
  const rs = await prisma.recorrenciaFinanceira.findMany({
    orderBy: [{ ativa: "desc" }, { diaVencimento: "asc" }],
    select: {
      id: true,
      tipo: true,
      descricao: true,
      valor: true,
      diaVencimento: true,
      ativa: true,
      categoriaId: true,
      categoria: { select: { nome: true } },
      ultimaCompetencia: true,
      observacoes: true,
    },
  });
  return rs.map((r) => ({
    id: r.id,
    tipo: r.tipo as "ENTRADA" | "SAIDA",
    descricao: r.descricao,
    valor: Number(r.valor),
    diaVencimento: r.diaVencimento,
    ativa: r.ativa,
    categoriaId: r.categoriaId,
    categoriaNome: r.categoria?.nome ?? null,
    ultimaCompetencia: r.ultimaCompetencia,
    observacoes: r.observacoes,
  }));
}

export async function getRecorrencia(id: string): Promise<RecorrenciaItem | null> {
  const todas = await listarRecorrencias();
  return todas.find((r) => r.id === id) ?? null;
}
