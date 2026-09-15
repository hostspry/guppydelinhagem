-- Unidades da Gollog passam a vir da lista oficial da Gollog (sincronizada),
-- no lugar da lista montada à mão no código.
ALTER TABLE "Order" ADD COLUMN "unidadeGollogId" TEXT;

CREATE TABLE "UnidadeGollog" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "codigo" VARCHAR(3) NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "endereco" TEXT NOT NULL,
    "cep" TEXT,
    "telefone" TEXT,
    "horario" TEXT,
    "email" TEXT,
    "tipoServico" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "naListaGollog" BOOLEAN NOT NULL DEFAULT true,
    "sincronizadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnidadeGollog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UnidadeGollog_titulo_key" ON "UnidadeGollog"("titulo");
CREATE INDEX "UnidadeGollog_codigo_idx" ON "UnidadeGollog"("codigo");
CREATE INDEX "UnidadeGollog_uf_cidade_idx" ON "UnidadeGollog"("uf", "cidade");
