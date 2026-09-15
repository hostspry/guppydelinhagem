-- Duas versões de cada foto de produto: url (site, até 100 KB) e urlAlta (até
-- 1920 px, para o Mercado Livre). Foto antiga fica com urlAlta nulo e o ML usa
-- a url, como antes.
ALTER TABLE "ProductImage" ADD COLUMN "urlAlta" TEXT;
