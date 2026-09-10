/**
 * Cores dos gráficos de visitantes.
 *
 * Não são escolhidas a olho: foram validadas contra a superfície branca dos
 * cartões do admin (`#ffffff`) pelo validador de paleta, que confere faixa de
 * luminosidade, saturação mínima, separação para daltonismo e contraste.
 *
 *   node scripts/validate_palette.js "#2a78d6,#eb6834" --mode light --surface "#ffffff"
 *   node scripts/validate_palette.js "#86b6ef,#5598e7,#2a78d6,#1c5cab,#104281" \
 *     --mode light --surface "#ffffff" --ordinal
 *
 * O azul-escuro da marca (#07366A) fica de fora das séries de propósito: ele é
 * quase preto e, ao lado do texto, some. Marca segue no cabeçalho e nos botões;
 * dado tem cor de dado.
 */

/** Séries que convivem no mesmo gráfico, em ordem fixa. Nunca cicle esta lista. */
export const SERIE = {
  /** Slot 1 — azul. Medida principal. */
  um: "#2a78d6",
  /** Slot 2 — laranja. Separação para daltonismo: ΔE 24,7 contra o slot 1. */
  dois: "#eb6834",
  /** Slot 3 — verde-água. Só entra em gráfico de até três séries. */
  tres: "#1baf7a",
} as const;

/**
 * Rampa do funil: um tom só, do claro ao escuro, cinco degraus.
 *
 * Ordinal e não categórica — as etapas do funil têm ordem, e cor por ordem
 * mostra isso. Começa no degrau 250 porque, mais claro que isso, a barra some
 * no branco do cartão.
 */
export const RAMPA_FUNIL = [
  "#86b6ef",
  "#5598e7",
  "#2a78d6",
  "#1c5cab",
  "#104281",
] as const;

/** Cinzas do desenho: grade, eixo e texto. Recessivos por definição. */
export const CHROME = {
  grade: "#ececeb",
  eixo: "#d6d6d4",
  textoFraco: "#8a8a86",
  texto: "#52514e",
  superficie: "#ffffff",
} as const;
