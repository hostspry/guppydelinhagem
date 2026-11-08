/**
 * Taxa do cartão repassada ao cliente nos links de cobrança e de leilão.
 *
 * Regra do dono (08/11/2026): no cartão a loja recebe o mesmo valor do Pix,
 * sem desconto a mais nem a menos, e o cliente escolhe em quantas vezes paga.
 * Nos pagamentos reais da conta, o Mercado Pago desconta 4,98% do valor no
 * crédito, à vista ou parcelado. Os juros da parcela o próprio Mercado Pago soma
 * por cima e quem paga é o cliente. Então o valor no cartão é o do Pix dividido
 * por (1 - taxa): R$ 630 viram R$ 663,02, a taxa de 4,98% sobre isso dá
 * R$ 33,02, e sobram os R$ 630.
 *
 * Função pura, sem banco: a página usa para mostrar o valor e montar o Brick, e
 * o servidor usa a MESMA conta para cobrar. Os dois precisam dar igual, senão
 * as parcelas que o cliente viu não batem com o que foi cobrado.
 */

/** Nome da linha que entra no pedido quando o cartão é aprovado. */
export const ITEM_TAXA_CARTAO = "Taxa do cartão";

/** Valor a cobrar no cartão para a loja receber `total` limpo. */
export function valorNoCartao(total: number, taxaPercent: number): number {
  if (!(total > 0) || !(taxaPercent > 0) || taxaPercent >= 100) return round2(total);
  // Arredonda para cima: arredondar para baixo deixaria a loja um centavo curta.
  // O épsilon evita que 663.0200000001 vire 663.03.
  return Math.ceil((total / (1 - taxaPercent / 100)) * 100 - 1e-6) / 100;
}

/** Quanto o cartão soma ao valor (0 quando não há taxa). */
export function taxaNoCartao(total: number, taxaPercent: number): number {
  return round2(valorNoCartao(total, taxaPercent) - round2(total));
}

/** "4,98%" — para o texto da página. */
export function rotuloTaxaCartao(taxaPercent: number): string {
  return `${taxaPercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
