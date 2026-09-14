-- Integração com o Mercado Livre.
--
-- Diferente da Shopee, o ML aceita peixe ornamental vivo (com o número da
-- licença do IBAMA no anúncio), então aqui não vale a regra de "só produto
-- seco": a ligação anúncio↔produto serve para linhagem também.
--
-- O refresh_token do ML é de USO ÚNICO e vale 6 meses. O access_token dura 6 h.
-- Por isso as duas datas separadas: uma diz quando renovar, a outra diz quando
-- a autorização morre de vez se ninguém renovar.

-- Venda registrada à mão também precisa saber de onde veio.
ALTER TYPE "OrigemVenda" ADD VALUE IF NOT EXISTS 'MERCADO_LIVRE';

CREATE TABLE "IntegracaoMercadoLivre" (
  "id"                        TEXT NOT NULL DEFAULT 'default',
  "ativo"                     BOOLEAN NOT NULL DEFAULT false,
  "clientId"                  TEXT,
  "clientSecretCriptografado" TEXT,
  "sellerId"                  TEXT,
  "apelido"                   TEXT,
  "accessTokenCriptografado"  TEXT,
  "refreshTokenCriptografado" TEXT,
  "tokenExpiraEm"             TIMESTAMP(3),
  "refreshEmitidoEm"          TIMESTAMP(3),
  "ultimaSincronizacaoEm"     TIMESTAMP(3),
  "ultimoErro"                TEXT,
  "atualizadoEm"              TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IntegracaoMercadoLivre_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MercadoLivreAnuncio" (
  "id"             TEXT NOT NULL,
  "productId"      TEXT NOT NULL,
  "itemId"         TEXT NOT NULL,
  "variationId"    TEXT,
  "titulo"         TEXT,
  "estoqueEnviado" INTEGER,
  "sincronizadoEm" TIMESTAMP(3),
  "ultimoErro"     TEXT,
  "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MercadoLivreAnuncio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MercadoLivreAnuncio_itemId_variationId_key"
  ON "MercadoLivreAnuncio" ("itemId", "variationId");
CREATE INDEX "MercadoLivreAnuncio_productId_idx"
  ON "MercadoLivreAnuncio" ("productId");

ALTER TABLE "MercadoLivreAnuncio"
  ADD CONSTRAINT "MercadoLivreAnuncio_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
