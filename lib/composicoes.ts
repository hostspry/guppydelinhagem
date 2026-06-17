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

export const QTD_PEIXES_PADRAO: Record<TipoComposicao, number> = {
  TRIO: 3,
  CASAL: 2,
  MACHO: 1,
  FEMEA: 1,
  LOTE: 10,
};

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

// Estoque derivado do trio (T = estoque do trio). Trio = 1 macho + 2 fêmeas →
// fêmea rende 2T. LOTE fica fora (estoque livre).
export const ESTOQUE_POR_TRIO = { CASAL: 1, MACHO: 1, FEMEA: 2 } as const;

/** Dado o estoque do trio, sugere casal/macho (= T) e fêmea (= 2T). */
export function sugerirEstoque(trioEstoque: number) {
  const t = Math.max(0, Math.floor(trioEstoque || 0));
  return {
    CASAL: t * ESTOQUE_POR_TRIO.CASAL,
    MACHO: t * ESTOQUE_POR_TRIO.MACHO,
    FEMEA: t * ESTOQUE_POR_TRIO.FEMEA,
  };
}
