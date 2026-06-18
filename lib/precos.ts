// Fonte ÚNICA da verdade do cálculo de preço Pix × Cartão. Funções PURAS (sem
// I/O) — usadas no servidor (recálculo autoritativo no checkout/pagamento) e no
// client (exibição). O servidor é quem manda: nunca confiar em valor do client.
//
// Regra de negócio (fechada com o dono):
//  - preço cheio = preço do CARTÃO à vista (Product.preco / variante.preco);
//  - Pix tem desconto %: PRÓPRIO do produto (Product.descontoPix) tem precedência;
//    senão, se o produto usa o global (usarDescontoPixGlobal), aplica o global da
//    loja (ConfiguracaoLoja.descontoPixGlobalPercent); senão, sem desconto.

export type ConfigPreco = { descontoPixGlobalPercent: number };

export type EntradaPreco = {
  precoBase: number; // preço cheio (cartão à vista) — variante ou produto
  descontoPixProprio?: number | null; // % próprio do produto (0–100); 0/null = sem
  usarDescontoPixGlobal?: boolean;
};

export type PrecoCalc = {
  precoCartao: number; // = preço cheio (cartão à vista)
  descontoPixPercent: number; // % efetivo aplicado no Pix
  precoPix: number; // cheio × (1 − %/100), 2 casas
  economiaPix: number; // precoCartao − precoPix
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampPct = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Desconto Pix efetivo (%). Precedência: próprio (se > 0) → global (se a flag do
 * produto liga) → 0.
 */
export function resolverDescontoPixPercent(
  e: { descontoPixProprio?: number | null; usarDescontoPixGlobal?: boolean },
  config: ConfigPreco,
): number {
  const proprio = clampPct(e.descontoPixProprio ?? 0);
  if (proprio > 0) return proprio;
  if (e.usarDescontoPixGlobal) {
    return clampPct(config.descontoPixGlobalPercent ?? 0);
  }
  return 0;
}

export function calcularPrecos(e: EntradaPreco, config: ConfigPreco): PrecoCalc {
  const precoCartao = round2(e.precoBase);
  const pct = resolverDescontoPixPercent(e, config);
  const precoPix = round2(precoCartao * (1 - pct / 100));
  return {
    precoCartao,
    descontoPixPercent: pct,
    precoPix,
    economiaPix: round2(precoCartao - precoPix),
  };
}
