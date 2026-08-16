-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "StatusLancamento" AS ENUM ('PENDENTE', 'CONFIRMADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "OrigemLancamento" AS ENUM ('MANUAL', 'PEDIDO', 'TAXA_PAGAMENTO', 'FRETE', 'RECORRENCIA', 'COMPROVANTE');

-- CreateTable
CREATE TABLE "CategoriaFinanceira" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tipo" "TipoLancamento",
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "status" "StatusLancamento" NOT NULL DEFAULT 'CONFIRMADO',
    "origem" "OrigemLancamento" NOT NULL DEFAULT 'MANUAL',
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "vencimento" TIMESTAMP(3),
    "categoriaId" TEXT,
    "orderId" TEXT,
    "pagamentoId" TEXT,
    "comprovanteUrl" TEXT,
    "observacoes" TEXT,
    "recorrenciaId" TEXT,
    "criadoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecorrenciaFinanceira" (
    "id" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL DEFAULT 'SAIDA',
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "diaVencimento" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "categoriaId" TEXT,
    "ultimaCompetencia" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecorrenciaFinanceira_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaFinanceira_slug_key" ON "CategoriaFinanceira"("slug");

-- CreateIndex
CREATE INDEX "CategoriaFinanceira_tipo_ativa_idx" ON "CategoriaFinanceira"("tipo", "ativa");

-- CreateIndex
CREATE INDEX "Lancamento_status_data_idx" ON "Lancamento"("status", "data");

-- CreateIndex
CREATE INDEX "Lancamento_data_idx" ON "Lancamento"("data");

-- CreateIndex
CREATE INDEX "Lancamento_categoriaId_idx" ON "Lancamento"("categoriaId");

-- CreateIndex
CREATE INDEX "Lancamento_orderId_idx" ON "Lancamento"("orderId");

-- CreateIndex
CREATE INDEX "Lancamento_status_vencimento_idx" ON "Lancamento"("status", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Lancamento_pagamentoId_origem_key" ON "Lancamento"("pagamentoId", "origem");

-- CreateIndex
CREATE INDEX "RecorrenciaFinanceira_ativa_idx" ON "RecorrenciaFinanceira"("ativa");

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_recorrenciaId_fkey" FOREIGN KEY ("recorrenciaId") REFERENCES "RecorrenciaFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecorrenciaFinanceira" ADD CONSTRAINT "RecorrenciaFinanceira_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

