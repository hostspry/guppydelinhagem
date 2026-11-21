import type { SegmentoFinanceiro } from "@/lib/generated/prisma/enums";
import { competenciaDe } from "./periodo";

/**
 * Fechamento do mês: quanto cabe a cada pessoa.
 *
 * Estufa: o resultado do mês (entradas menos custos) vai para o Manassés até
 * R$ 6.000. O que passar disso é dividido meio a meio com o Lucas. A conta é
 * refeita em cada mês, porque o piso de R$ 6.000 é mensal.
 *
 * Produtos: tudo é da Lívia, descontados os custos dessa parte.
 *
 * Retirada NÃO é custo. Se fosse, o dinheiro que um sócio recebeu diminuiria a
 * parte dos dois. Ela sai só do saldo de quem recebeu.
 *
 * Arquivo puro (sem banco) e em centavos, para a soma das partes bater com o
 * resultado sem sobra de arredondamento.
 */

export const PISO_MANASSES = 6000;
const PISO_CENTAVOS = PISO_MANASSES * 100;
const SLUG_FRETE = "frete-postagem";

type Pessoa = "manasses" | "lucas" | "livia";

const RETIRADAS: Record<SegmentoFinanceiro, Record<string, Pessoa>> = {
  PEIXES_VIVOS: { "retirada-dono": "manasses", "retirada-lucas": "lucas" },
  PRODUTOS: { "retirada-livia": "livia" },
};

export type LinhaCaixa = {
  segmento: SegmentoFinanceiro;
  tipo: "ENTRADA" | "SAIDA";
  valor: number;
  data: Date;
  categoriaSlug: string | null;
};

export type SaldoSocio = {
  /** Metade do que passou de R$ 6.000 no mês. */
  metade: number;
  /** Parte do mês antes das retiradas. */
  parte: number;
  retirado: number;
  saldoMes: number;
  /** Todas as partes até este mês, menos todas as retiradas. */
  acumulado: number;
};

export type FechamentoEstufa = {
  entradas: number;
  custos: number;
  resultado: number;
  aConferir: number;
  /** Quanto do piso de R$ 6.000 foi preenchido neste mês. */
  primeiros: number;
  manasses: SaldoSocio;
  lucas: SaldoSocio;
};

export type FechamentoProdutos = {
  entradas: number;
  frete: number;
  outrosCustos: number;
  custos: number;
  retirado: number;
  saldoMes: number;
  acumulado: number;
  aConferir: number;
};

export type Fechamento = {
  competencia: string;
  /** Nulo para quem não enxerga a estufa. */
  estufa: FechamentoEstufa | null;
  /** Nulo para quem não enxerga produtos. */
  produtos: FechamentoProdutos | null;
};

const centavos = (v: number) => Math.round(v * 100);
const reais = (c: number) => c / 100;

/** Divide o resultado de UM mês da estufa. Tudo em centavos. */
export function dividirResultadoEstufa(resultado: number): {
  primeiros: number;
  metadeManasses: number;
  metadeLucas: number;
  manasses: number;
  lucas: number;
} {
  const excedente = Math.max(0, resultado - PISO_CENTAVOS);
  // Centavo ímpar fica com o Manassés, para a soma fechar no resultado.
  const metadeLucas = Math.floor(excedente / 2);
  const metadeManasses = excedente - metadeLucas;
  return {
    primeiros: Math.min(resultado, PISO_CENTAVOS),
    metadeManasses,
    metadeLucas,
    manasses: resultado - metadeLucas,
    lucas: metadeLucas,
  };
}

type Mes = {
  entradas: number;
  custos: number;
  frete: number;
  retiradas: Record<Pessoa, number>;
};

const mesVazio = (): Mes => ({
  entradas: 0,
  custos: 0,
  frete: 0,
  retiradas: { manasses: 0, lucas: 0, livia: 0 },
});

function agruparPorMes(
  linhas: LinhaCaixa[],
  segmento: SegmentoFinanceiro,
  competencia: string,
): Map<string, Mes> {
  const meses = new Map<string, Mes>();
  for (const l of linhas) {
    if (l.segmento !== segmento) continue;
    const chave = competenciaDe(l.data);
    if (chave > competencia) continue;

    const mes = meses.get(chave) ?? mesVazio();
    meses.set(chave, mes);
    const valor = centavos(l.valor);

    if (l.tipo === "ENTRADA") {
      mes.entradas += valor;
      continue;
    }
    const quem = l.categoriaSlug ? RETIRADAS[segmento][l.categoriaSlug] : undefined;
    if (quem) {
      mes.retiradas[quem] += valor;
      continue;
    }
    mes.custos += valor;
    if (l.categoriaSlug === SLUG_FRETE) mes.frete += valor;
  }
  return meses;
}

function montarEstufa(
  linhas: LinhaCaixa[],
  competencia: string,
  aConferir: number,
): FechamentoEstufa {
  const meses = agruparPorMes(linhas, "PEIXES_VIVOS", competencia);

  let acumuladoManasses = 0;
  let acumuladoLucas = 0;
  for (const m of meses.values()) {
    const d = dividirResultadoEstufa(m.entradas - m.custos);
    acumuladoManasses += d.manasses - m.retiradas.manasses;
    acumuladoLucas += d.lucas - m.retiradas.lucas;
  }

  const m = meses.get(competencia) ?? mesVazio();
  const resultado = m.entradas - m.custos;
  const d = dividirResultadoEstufa(resultado);

  return {
    entradas: reais(m.entradas),
    custos: reais(m.custos),
    resultado: reais(resultado),
    aConferir,
    primeiros: reais(d.primeiros),
    manasses: {
      metade: reais(d.metadeManasses),
      parte: reais(d.manasses),
      retirado: reais(m.retiradas.manasses),
      saldoMes: reais(d.manasses - m.retiradas.manasses),
      acumulado: reais(acumuladoManasses),
    },
    lucas: {
      metade: reais(d.metadeLucas),
      parte: reais(d.lucas),
      retirado: reais(m.retiradas.lucas),
      saldoMes: reais(d.lucas - m.retiradas.lucas),
      acumulado: reais(acumuladoLucas),
    },
  };
}

function montarProdutos(
  linhas: LinhaCaixa[],
  competencia: string,
  aConferir: number,
): FechamentoProdutos {
  const meses = agruparPorMes(linhas, "PRODUTOS", competencia);

  let acumulado = 0;
  for (const m of meses.values()) {
    acumulado += m.entradas - m.custos - m.retiradas.livia;
  }

  const m = meses.get(competencia) ?? mesVazio();
  return {
    entradas: reais(m.entradas),
    frete: reais(m.frete),
    outrosCustos: reais(m.custos - m.frete),
    custos: reais(m.custos),
    retirado: reais(m.retiradas.livia),
    saldoMes: reais(m.entradas - m.custos - m.retiradas.livia),
    acumulado: reais(acumulado),
    aConferir,
  };
}

/**
 * `segmentos` é o que a pessoa pode ver. O lado que ela não enxerga volta nulo,
 * e a consulta nem chega a trazer essas linhas do banco.
 */
export function montarFechamento(args: {
  competencia: string;
  linhas: LinhaCaixa[];
  aConferir: Partial<Record<SegmentoFinanceiro, number>>;
  segmentos: readonly SegmentoFinanceiro[];
}): Fechamento {
  const { competencia, linhas, aConferir, segmentos } = args;
  return {
    competencia,
    estufa: segmentos.includes("PEIXES_VIVOS")
      ? montarEstufa(linhas, competencia, aConferir.PEIXES_VIVOS ?? 0)
      : null,
    produtos: segmentos.includes("PRODUTOS")
      ? montarProdutos(linhas, competencia, aConferir.PRODUTOS ?? 0)
      : null,
  };
}
