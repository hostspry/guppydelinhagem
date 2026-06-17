-- CreateEnum
CREATE TYPE "TipoComposicao" AS ENUM ('TRIO', 'CASAL', 'MACHO', 'FEMEA', 'LOTE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProductType" ADD VALUE 'PEIXE';
ALTER TYPE "ProductType" ADD VALUE 'CORAL';
ALTER TYPE "ProductType" ADD VALUE 'PLANTA';
ALTER TYPE "ProductType" ADD VALUE 'ALIMENTO_VIVO';
ALTER TYPE "ProductType" ADD VALUE 'RACAO';
ALTER TYPE "ProductType" ADD VALUE 'ACESSORIO';

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "composicao" "TipoComposicao" NOT NULL,
    "preco" DECIMAL(10,2) NOT NULL,
    "estoque" INTEGER NOT NULL DEFAULT 0,
    "qtdPeixes" INTEGER NOT NULL,
    "rotulo" TEXT,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_composicao_key" ON "ProductVariant"("productId", "composicao");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
