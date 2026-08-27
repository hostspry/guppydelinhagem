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

// ── Série do caixa (gráfico de entradas x saídas ao longo do tempo) ──────────
export type GranularidadeSerie = "dia" | "semana" | "mes" | "ano";

export type PontoSerie = {
  /** Início do balde, em ISO (chave estável para o React e para a tabela). */
  chave: string;
  rotulo: string; // eixo X, já em pt-BR
  rotuloLongo: string; // tooltip e tabela
  entradas: number;
  saidas: number;
};

// Janela de cada granularidade. Dia num período longo vira ruído ilegível, então
// cada grão tem a sua janela — quem escolhe "por dia" quer o mês, não 3 anos.
const JANELA: Record<GranularidadeSerie, number> = {
  dia: 30,
  semana: 12,
  mes: 12,
  ano: 5,
};

const TRUNC: Record<GranularidadeSerie, string> = {
  dia: "day",
  semana: "week",
  mes: "month",
  ano: "year",
};

/** Começo do balde que contém `d`, em UTC (as datas são gravadas ao meio-dia UTC). */
function inicioDoBalde(d: Date, g: GranularidadeSerie): Date {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  if (g === "ano") return new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  if (g === "mes") return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1));
  if (g === "semana") {
    // date_trunc('week') do Postgres começa na SEGUNDA — o passo aqui tem que
    // usar a mesma âncora, senão os baldes não casam com os do banco.
    const diaSemana = (x.getUTCDay() + 6) % 7; // 0 = segunda
    x.setUTCDate(x.getUTCDate() - diaSemana);
    return x;
  }
  return x;
}

function passoAtras(d: Date, g: GranularidadeSerie, n: number): Date {
  const x = new Date(d);
  if (g === "ano") x.setUTCFullYear(x.getUTCFullYear() - n);
  else if (g === "mes") x.setUTCMonth(x.getUTCMonth() - n);
  else if (g === "semana") x.setUTCDate(x.getUTCDate() - 7 * n);
  else x.setUTCDate(x.getUTCDate() - n);
  return x;
}

const MES_CURTO = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function rotulos(d: Date, g: GranularidadeSerie): { curto: string; longo: string } {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = MES_CURTO[d.getUTCMonth()];
  const aaaa = d.getUTCFullYear();
  if (g === "ano") return { curto: String(aaaa), longo: String(aaaa) };
  if (g === "mes") {
    return { curto: `${mm}/${String(aaaa).slice(2)}`, longo: `${mm} de ${aaaa}` };
  }
  if (g === "semana") {
    const fim = new Date(d);
    fim.setUTCDate(fim.getUTCDate() + 6);
    const fdd = String(fim.getUTCDate()).padStart(2, "0");
    return {
      curto: `${dd}/${mm}`,
      longo: `semana de ${dd}/${mm} a ${fdd}/${MES_CURTO[fim.getUTCMonth()]}`,
    };
  }
  return { curto: `${dd}/${mm}`, longo: `${dd}/${mm}/${aaaa}` };
}

/**
 * Entradas e saídas por período, para o gráfico do caixa.
 *
 * Só CONFIRMADO: conta a pagar que ainda não foi quitada não mexeu no caixa e
 * não pode aparecer como se tivesse mexido.
 *
 * Baldes vazios são preenchidos com zero — sem isso a linha pularia de um dia
 * com movimento para o próximo, mentindo sobre o eixo do tempo.
 */
export async function serieDoCaixa(
  granularidade: GranularidadeSerie,
): Promise<PontoSerie[]> {
  const quantos = JANELA[granularidade];
  const fim = inicioDoBalde(new Date(), granularidade);
  const inicio = passoAtras(fim, granularidade, quantos - 1);

  const linhas = await prisma.$queryRawUnsafe<
    { bucket: Date; entradas: unknown; saidas: unknown }[]
  >(
    `SELECT date_trunc('${TRUNC[granularidade]}', "data") AS bucket,
            SUM(CASE WHEN "tipo" = 'ENTRADA' THEN "valor" ELSE 0 END) AS entradas,
            SUM(CASE WHEN "tipo" = 'SAIDA'   THEN "valor" ELSE 0 END) AS saidas
       FROM "Lancamento"
      WHERE "status" = 'CONFIRMADO' AND "data" >= $1
      GROUP BY 1
      ORDER BY 1`,
    inicio,
  );

  const porChave = new Map<string, { entradas: number; saidas: number }>();
  for (const l of linhas) {
    const chave = inicioDoBalde(new Date(l.bucket), granularidade)
      .toISOString()
      .slice(0, 10);
    porChave.set(chave, {
      entradas: Number(l.entradas ?? 0),
      saidas: Number(l.saidas ?? 0),
    });
  }

  const pontos: PontoSerie[] = [];
  for (let i = quantos - 1; i >= 0; i--) {
    const d = passoAtras(fim, granularidade, i);
    const chave = d.toISOString().slice(0, 10);
    const v = porChave.get(chave) ?? { entradas: 0, saidas: 0 };
    const r = rotulos(d, granularidade);
    pontos.push({
      chave,
      rotulo: r.curto,
      rotuloLongo: r.longo,
      entradas: v.entradas,
      saidas: v.saidas,
    });
  }
  return pontos;
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

// ─────────────────────────────────────────────
// "Esse dinheiro eu já conheço?"
//
// Duas perguntas diferentes que o leitor de comprovante precisa fazer antes de
// criar mais uma linha no caixa:
//
//  1. MESMO PAGAMENTO, OUTRO DOCUMENTO. O cliente manda o print e depois o PDF;
//     ou ele manda o print e o banco manda o aviso. Bytes diferentes, então a
//     trava por hash do arquivo não pega. Entrada duplicada é pior que entrada
//     faltando: o caixa fica maior do que o dinheiro real e nada parece errado.
//
//  2. REPASSE DE UMA VENDA QUE JÁ ENTROU. Um sócio passa pro outro dinheiro que
//     já foi lançado quando o cliente pagou. Lançar de novo como saída faz a
//     venda desaparecer do caixa.
//
// Cuidado que vale para as duas: peixe tem preço de tabela, então dois clientes
// pagando R$ 250 no mesmo dia é rotina, não coincidência. Valor e data sozinhos
// NÃO indicam duplicata — sem nome batendo, o alerta vira ruído e o dono para de
// ler. Por isso a comparação de contraparte manda no resultado.
// ─────────────────────────────────────────────

export type LancamentoParecido = {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  descricao: string;
  valor: number;
  data: Date;
  status: string;
  /** FORTE = nome bateu também. FRACO = só valor e data, sem nome pra comparar. */
  forca: "FORTE" | "FRACO";
};

/** "José da Silva Souza" → ["JOSE", "SILVA", "SOUZA"] (descarta "da", "de"...). */
function tokens(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 4);
}

const JANELA_DUPLICATA_MS = 24 * 60 * 60 * 1000; // comprovante emitido no dia seguinte
const DIAS_BUSCA_REPASSE = 30;

/**
 * Lançamentos que parecem ser ESTE MESMO pagamento já registrado. Compara valor
 * exato (Pix não arredonda), data com um dia de folga e o nome da contraparte.
 * Sem nome batendo, devolve FRACO — para o aviso poder ser mais discreto.
 */
export async function procurarMesmoPagamento(args: {
  tipo: "ENTRADA" | "SAIDA";
  valor: number;
  data: Date;
  contraparte: string | null;
  ignorarId?: string;
}): Promise<LancamentoParecido[]> {
  const { tipo, valor, data, contraparte, ignorarId } = args;

  const linhas = await prisma.lancamento.findMany({
    where: {
      tipo,
      valor,
      status: { not: "DESCARTADO" },
      data: {
        gte: new Date(data.getTime() - JANELA_DUPLICATA_MS),
        lte: new Date(data.getTime() + JANELA_DUPLICATA_MS),
      },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      valor: true,
      data: true,
      status: true,
      observacoes: true,
    },
    orderBy: { data: "desc" },
    take: 5,
  });

  const alvo = contraparte ? tokens(contraparte) : [];

  return linhas.map((l) => {
    const texto = tokens(`${l.descricao} ${l.observacoes ?? ""}`);
    const comuns = alvo.filter((t) => texto.includes(t));
    // Um sobrenome incomum já identifica; dois pedaços batendo dispensa dúvida.
    const bateu = comuns.length >= 2 || (alvo.length === 1 && comuns.length === 1);
    return {
      id: l.id,
      tipo: l.tipo as "ENTRADA" | "SAIDA",
      descricao: l.descricao,
      valor: Number(l.valor),
      data: l.data,
      status: l.status,
      forca: bateu ? ("FORTE" as const) : ("FRACO" as const),
    };
  });
}

/**
 * Para um repasse entre os sócios: entradas do mesmo valor já no caixa, que
 * podem ser a venda de onde esse dinheiro veio. Nenhuma resposta aqui é prova —
 * serve para o dono reconhecer a venda e decidir não lançar de novo.
 *
 * Só casa valor exato. Repasse que junta várias vendas numa transferência só não
 * aparece, e é por isso que o aviso precisa dizer que não achou em vez de ficar
 * calado.
 */
export async function procurarOrigemDoRepasse(args: {
  valor: number;
  data: Date;
}): Promise<LancamentoParecido[]> {
  const desde = new Date(args.data.getTime() - DIAS_BUSCA_REPASSE * 24 * 60 * 60 * 1000);

  const linhas = await prisma.lancamento.findMany({
    where: {
      tipo: "ENTRADA",
      valor: args.valor,
      status: { not: "DESCARTADO" },
      data: { gte: desde, lte: new Date(args.data.getTime() + JANELA_DUPLICATA_MS) },
    },
    select: { id: true, tipo: true, descricao: true, valor: true, data: true, status: true },
    orderBy: { data: "desc" },
    take: 5,
  });

  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo as "ENTRADA" | "SAIDA",
    descricao: l.descricao,
    valor: Number(l.valor),
    data: l.data,
    status: l.status,
    forca: "FORTE" as const,
  }));
}
