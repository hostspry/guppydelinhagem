-- Integração com a Shopee: pedidos importados e estoque sincronizado.

-- De onde veio a venda. Pedido de marketplace tem ciclo próprio — quem cobra,
-- quem despacha e quem fala com o cliente é a Shopee, não a gente.
DO $$ BEGIN
  CREATE TYPE "OrigemVenda" AS ENUM ('SITE', 'WHATSAPP', 'SHOPEE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AmbienteShopee" AS ENUM ('SANDBOX', 'PRODUCAO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "origem" "OrigemVenda" NOT NULL DEFAULT 'SITE',
  ADD COLUMN IF NOT EXISTS "origemPedidoId" TEXT;

-- Trava contra pedido duplicado: o webhook da Shopee repete, e a varredura pode
-- rodar junto com ele. Pedido do site fica de fora sozinho — no Postgres, nulos
-- não competem por unicidade, então milhares deles convivem neste índice.
CREATE UNIQUE INDEX IF NOT EXISTS "Order_origem_origemPedidoId_key"
  ON "Order" ("origem", "origemPedidoId");

CREATE INDEX IF NOT EXISTS "Order_origem_status_idx" ON "Order" ("origem", "status");

CREATE TABLE IF NOT EXISTS "IntegracaoShopee" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "ativo" BOOLEAN NOT NULL DEFAULT false,
  "ambiente" "AmbienteShopee" NOT NULL DEFAULT 'SANDBOX',
  "partnerId" TEXT,
  "partnerKeyCriptografada" TEXT,
  "shopId" TEXT,
  "accessTokenCriptografado" TEXT,
  "refreshTokenCriptografado" TEXT,
  "tokenExpiraEm" TIMESTAMP(3),
  "refreshEmitidoEm" TIMESTAMP(3),
  "ultimaSincronizacaoEm" TIMESTAMP(3),
  "ultimoErro" TEXT,
  "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "IntegracaoShopee_pkey" PRIMARY KEY ("id")
);

-- Linha única, criada desligada. A tela de configuração edita esta linha em vez
-- de criar uma, então ela precisa existir desde já.
INSERT INTO "IntegracaoShopee" ("id") VALUES ('default')
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "ShopeeAnuncio" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "modelId" TEXT,
  "titulo" TEXT,
  "estoqueEnviado" INTEGER,
  "sincronizadoEm" TIMESTAMP(3),
  "ultimoErro" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "ShopeeAnuncio_pkey" PRIMARY KEY ("id")
);

-- Um anúncio (ou variação) pertence a um produto só.
CREATE UNIQUE INDEX IF NOT EXISTS "ShopeeAnuncio_itemId_modelId_key"
  ON "ShopeeAnuncio" ("itemId", "modelId");
-- O de cima não segura anúncio SEM variação: nulo não compete por unicidade, e
-- o mesmo item entraria duas vezes. Este índice fecha essa porta.
CREATE UNIQUE INDEX IF NOT EXISTS "ShopeeAnuncio_itemId_sem_modelo_key"
  ON "ShopeeAnuncio" ("itemId") WHERE "modelId" IS NULL;
CREATE INDEX IF NOT EXISTS "ShopeeAnuncio_productId_idx" ON "ShopeeAnuncio" ("productId");

ALTER TABLE "ShopeeAnuncio" DROP CONSTRAINT IF EXISTS "ShopeeAnuncio_productId_fkey";
ALTER TABLE "ShopeeAnuncio"
  ADD CONSTRAINT "ShopeeAnuncio_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
