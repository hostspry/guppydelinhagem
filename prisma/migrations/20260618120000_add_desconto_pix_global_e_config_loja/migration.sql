-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "usarDescontoPixGlobal" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ConfiguracaoLoja" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "descontoPixGlobalPercent" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConfiguracaoLoja_pkey" PRIMARY KEY ("id")
);
