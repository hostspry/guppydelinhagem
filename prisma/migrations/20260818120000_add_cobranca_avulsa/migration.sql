-- CreateEnum
CREATE TYPE "TipoOrder" AS ENUM ('PEDIDO', 'COBRANCA');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "tipo" "TipoOrder" NOT NULL DEFAULT 'PEDIDO',
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "expiraEm" TIMESTAMP(3),
ADD COLUMN     "maxParcelas" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");

-- CreateIndex
CREATE INDEX "Order_tipo_idx" ON "Order"("tipo");
