-- AlterTable
ALTER TABLE "ProductVideo" ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "principal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "titulo" TEXT,
ALTER COLUMN "videoId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ProductVideo_productId_idx" ON "ProductVideo"("productId");
