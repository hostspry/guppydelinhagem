-- AlterTable
ALTER TABLE "Order" ADD COLUMN "semanaEnvio" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_semanaEnvio_idx" ON "Order"("semanaEnvio");
