-- Pix que ficou com o Lucas: conta como retirada dele, visível só para o dono.
CREATE TABLE "RetiradaPrivadaLucas" (
    "id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetiradaPrivadaLucas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetiradaPrivadaLucas_lancamentoId_key" ON "RetiradaPrivadaLucas"("lancamentoId");

CREATE INDEX "RetiradaPrivadaLucas_data_idx" ON "RetiradaPrivadaLucas"("data");
