-- CreateEnum
CREATE TYPE "TipoCupom" AS ENUM ('SECRETO', 'CAMPANHA');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "cupomCodigo" TEXT,
ADD COLUMN     "cupomId" TEXT,
ADD COLUMN     "descontoUnitario" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "CupomDesconto" ADD COLUMN     "precoUnicoNaCampanha" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tipoCupom" "TipoCupom" NOT NULL DEFAULT 'SECRETO';

-- CreateIndex
CREATE INDEX "CupomDesconto_tipoCupom_ativo_idx" ON "CupomDesconto"("tipoCupom", "ativo");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "CupomDesconto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

