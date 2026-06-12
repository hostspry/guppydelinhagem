-- AlterTable
ALTER TABLE "WaitlistEntry" ALTER COLUMN "email" DROP NOT NULL,
ADD COLUMN     "whatsapp" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_productId_whatsapp_key" ON "WaitlistEntry"("productId", "whatsapp");
