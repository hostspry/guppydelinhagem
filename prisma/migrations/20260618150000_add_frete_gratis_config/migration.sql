-- AlterTable
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN     "freteGratisAcimaDe" DECIMAL(10,2),
ADD COLUMN     "freteGratisAtivo" BOOLEAN NOT NULL DEFAULT false;
