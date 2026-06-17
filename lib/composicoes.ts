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

// Âncora de preço (tudo editável; só pré-preenche).
export const PRECO = {
  CASAL_PCT: 0.75, // do trio
  MACHO_FIXO: 99,
  FEMEA_FIXO: 89,
} as const;

/** Dado o preço do trio, sugere casal/macho/fêmea (lote = livre). */
export function sugerirPrecos(precoTrio: number) {
  return {
    CASAL: Math.round(precoTrio * PRECO.CASAL_PCT * 100) / 100,
    MACHO: PRECO.MACHO_FIXO,
    FEMEA: PRECO.FEMEA_FIXO,
  };
}
