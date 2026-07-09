-- CreateTable
CREATE TABLE "LeadCheckout" (
    "id" TEXT NOT NULL,
    "nome" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "capturadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "notificadoEm" TIMESTAMP(3),
    "convertido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LeadCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadCheckout_convertido_notificadoEm_idx" ON "LeadCheckout"("convertido", "notificadoEm");

-- CreateIndex
CREATE INDEX "LeadCheckout_email_idx" ON "LeadCheckout"("email");

-- CreateIndex
CREATE INDEX "LeadCheckout_telefone_idx" ON "LeadCheckout"("telefone");
