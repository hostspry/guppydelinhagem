-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "selfTracking" TEXT,
ADD COLUMN     "etiquetaUrl" TEXT,
ADD COLUMN     "rastreioStatus" TEXT,
ADD COLUMN     "enviadoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RastreioEvento" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "descricao" TEXT,
    "ocorridoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RastreioEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "clienteId" TEXT,
    "userId" TEXT,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RastreioEvento_orderId_idx" ON "RastreioEvento"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "RastreioEvento_orderId_status_ocorridoEm_key" ON "RastreioEvento"("orderId", "status", "ocorridoEm");

-- CreateIndex
CREATE INDEX "Notificacao_clienteId_idx" ON "Notificacao"("clienteId");

-- CreateIndex
CREATE INDEX "Notificacao_userId_idx" ON "Notificacao"("userId");

-- CreateIndex
CREATE INDEX "Notificacao_orderId_idx" ON "Notificacao"("orderId");

-- AddForeignKey
ALTER TABLE "RastreioEvento" ADD CONSTRAINT "RastreioEvento_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
