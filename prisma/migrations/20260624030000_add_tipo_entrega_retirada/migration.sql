-- CreateEnum
CREATE TYPE "TipoEntrega" AS ENUM ('ENVIO', 'RETIRADA');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tipoEntrega" "TipoEntrega" NOT NULL DEFAULT 'ENVIO';

-- AlterTable
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN     "retiradaLocalAtiva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retiradaInstrucoes" TEXT;
