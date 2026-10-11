-- Leilões: cobrança dos arrematantes. Só acrescenta (enum, colunas opcionais
-- e tabelas novas): a versão no ar continua funcionando antes do deploy.

-- AlterEnum
ALTER TYPE "OrigemVenda" ADD VALUE IF NOT EXISTS 'LEILAO';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "entregaEscolhidaEm" TIMESTAMP(3),
ADD COLUMN     "leilaoId" TEXT;

-- CreateTable
CREATE TABLE "Leilao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataLeilao" TIMESTAMP(3) NOT NULL,
    "prazoPagamentoDias" INTEGER NOT NULL DEFAULT 3,
    "maxParcelas" INTEGER NOT NULL DEFAULT 12,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Leilao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoteLeilao" (
    "id" TEXT NOT NULL,
    "leilaoId" TEXT NOT NULL,
    "numero" TEXT,
    "nome" TEXT NOT NULL,
    "qtdPeixes" INTEGER NOT NULL DEFAULT 3,
    "valor" DECIMAL(10,2) NOT NULL,
    "clienteId" TEXT NOT NULL,
    "orderId" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoteLeilao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Leilao_dataLeilao_idx" ON "Leilao"("dataLeilao");

-- CreateIndex
CREATE INDEX "LoteLeilao_leilaoId_ordem_idx" ON "LoteLeilao"("leilaoId", "ordem");

-- CreateIndex
CREATE INDEX "LoteLeilao_clienteId_idx" ON "LoteLeilao"("clienteId");

-- CreateIndex
CREATE INDEX "LoteLeilao_orderId_idx" ON "LoteLeilao"("orderId");

-- CreateIndex
CREATE INDEX "Order_leilaoId_idx" ON "Order"("leilaoId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_leilaoId_fkey" FOREIGN KEY ("leilaoId") REFERENCES "Leilao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteLeilao" ADD CONSTRAINT "LoteLeilao_leilaoId_fkey" FOREIGN KEY ("leilaoId") REFERENCES "Leilao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteLeilao" ADD CONSTRAINT "LoteLeilao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteLeilao" ADD CONSTRAINT "LoteLeilao_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

