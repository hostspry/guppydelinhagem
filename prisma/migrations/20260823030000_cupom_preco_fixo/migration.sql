-- Preço final: o valor do cupom é o preço que o produto passa a custar, em vez
-- de um desconto. É o que "de R$ 250 por R$ 140" quer dizer quando a promoção
-- pega produtos de preços diferentes.
ALTER TYPE "TipoValorCupom" ADD VALUE IF NOT EXISTS 'PRECO_FIXO';
