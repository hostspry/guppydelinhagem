import type { ProductType } from "@/lib/generated/prisma/enums";

// Comportamento de frete por tipo de produto (mapa central — não espalhar `if`).
//
// Módulo PURO de propósito: o servidor decide o frete de verdade (lib/shipping),
// mas o checkout no browser precisa da mesma regra para saber se mostra as
// opções de peixe (terrestre/aéreo) ou as transportadoras do produto seco. Se
// isso morasse em lib/shipping, o `server-only` de lá quebraria o build do
// client — e duplicar o mapa era pedir para as duas metades divergirem.
//
// - cargaViva: viaja em caixa de isopor, só Jadlog/aéreo, com markup + isopor.
// - regraCaixaPeixe: peso/caixa fixos por pedido, não por unidade.
// - avisoIdade: exige o aviso de animal vivo no checkout.
export const FRETE_POR_TIPO: Record<
  ProductType,
  {
    calculaFrete: boolean;
    cargaViva: boolean;
    regraCaixaPeixe: boolean;
    avisoIdade: boolean;
  }
> = {
  PEIXE: { calculaFrete: true, cargaViva: true, regraCaixaPeixe: true, avisoIdade: true },
  CORAL: { calculaFrete: true, cargaViva: true, regraCaixaPeixe: false, avisoIdade: true },
  PLANTA: { calculaFrete: true, cargaViva: true, regraCaixaPeixe: false, avisoIdade: false },
  ALIMENTO_VIVO: { calculaFrete: true, cargaViva: true, regraCaixaPeixe: false, avisoIdade: false },
  RACAO: { calculaFrete: true, cargaViva: false, regraCaixaPeixe: false, avisoIdade: false },
  ACESSORIO: { calculaFrete: true, cargaViva: false, regraCaixaPeixe: false, avisoIdade: false },
  DIGITAL: { calculaFrete: false, cargaViva: false, regraCaixaPeixe: false, avisoIdade: false },
};

/**
 * Tipo desconhecido (item antigo no carrinho do navegador, payload estranho)
 * conta como carga viva de propósito: erra para o lado do frete mais caro e
 * seguro, nunca despachando peixe por uma transportadora que não leva vivo.
 */
export function ehCargaViva(tipo: string | null | undefined): boolean {
  if (!tipo) return true;
  const regra = FRETE_POR_TIPO[tipo as ProductType];
  return regra ? regra.cargaViva : true;
}

/** true quando NENHUM item do carrinho é carga viva (carrinho 100% seco). */
export function carrinhoSoSeco(itens: { tipo?: string | null }[]): boolean {
  return itens.length > 0 && itens.every((it) => !ehCargaViva(it.tipo));
}
