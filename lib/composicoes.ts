import type { TipoComposicao } from "@/lib/generated/prisma/enums";

// Fonte única das composições — usada no auto-fill do form, no seletor de compra
// e no script de migração. Importa o enum de /enums (chega ao client).

export const COMPOSICAO_LABEL: Record<TipoComposicao, string> = {
  TRIO: "Trio",
  CASAL: "Casal",
  MACHO: "Macho",
  FEMEA: "Fêmea",
  LOTE: "Lote",
};

// Receita de cada composição: quantos machos/fêmeas consome do pool do produto.
// (LOTE editável; aqui o default genérico.)
export const RECEITA_PADRAO: Record<TipoComposicao, { m: number; f: number }> = {
  TRIO: { m: 1, f: 2 },
  CASAL: { m: 1, f: 1 },
  MACHO: { m: 1, f: 0 },
  FEMEA: { m: 0, f: 1 },
  LOTE: { m: 1, f: 0 },
};

/** Quantidade de peixes (p/ frete) = machos + fêmeas da receita. */
export const qtdPeixesDe = (v: { qtdMachos: number; qtdFemeas: number }) =>
  v.qtdMachos + v.qtdFemeas;

/** Composição disponível quando o pool cobre a receita (machos E fêmeas). */
export const composicaoDisponivel = (
  v: { qtdMachos: number; qtdFemeas: number },
  pool: { machos: number; femeas: number },
) => pool.machos >= v.qtdMachos && pool.femeas >= v.qtdFemeas;

export const ORDEM_COMPOSICAO: TipoComposicao[] = [
  "TRIO",
  "CASAL",
  "MACHO",
  "FEMEA",
  "LOTE",
];

// Composições ligadas por padrão num produto peixe novo (FEMEA/LOTE off).
export const COMPOSICAO_PADRAO_LIGADA: Record<TipoComposicao, boolean> = {
  TRIO: true,
  CASAL: true,
  MACHO: true,
  FEMEA: false,
  LOTE: false,
};

// Preço de cada composição = percentual do trio (sem âncora fixa). Pré-preenche.
export const PRECO_PCT = { CASAL: 0.75, MACHO: 0.45, FEMEA: 0.4 } as const;

/** Inteiro mais próximo terminado em 9 (mínimo 9). */
export function arredonda9(x: number): number {
  const v = Math.round((x - 9) / 10) * 10 + 9;
  return v < 9 ? 9 : v;
}

/**
 * Dado o preço do trio, sugere casal/macho/fêmea como % do trio, arredondado
 * para o inteiro mais próximo terminado em 9. Lote = livre.
 */
export function sugerirPrecos(precoTrio: number) {
  return {
    CASAL: arredonda9(precoTrio * PRECO_PCT.CASAL),
    MACHO: arredonda9(precoTrio * PRECO_PCT.MACHO),
    FEMEA: arredonda9(precoTrio * PRECO_PCT.FEMEA),
  };
}
