-- Exceção por cobrança: o link do leilão cota o frete automático mesmo acima do
-- limite de peixes da loja (o dono libera caso a caso).
ALTER TABLE "Order" ADD COLUMN "freteSemLimitePeixes" BOOLEAN NOT NULL DEFAULT false;
