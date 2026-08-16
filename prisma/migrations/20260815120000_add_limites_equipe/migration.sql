-- AlterTable
ALTER TABLE "User" ADD COLUMN     "limiteDescontoPercent" INTEGER,
ADD COLUMN     "limiteValorFinanceiro" DECIMAL(10,2),
ADD COLUMN     "podeCancelarPedido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "podeEstornar" BOOLEAN NOT NULL DEFAULT false;
