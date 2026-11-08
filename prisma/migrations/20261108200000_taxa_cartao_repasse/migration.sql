-- Taxa do cartão repassada ao cliente nos links de cobrança e de leilão.
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "taxaCartaoPercent" DECIMAL(5,2) NOT NULL DEFAULT 4.98;
