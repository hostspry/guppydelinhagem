-- CreateEnum
CREATE TYPE "PublicoCampanha" AS ENUM ('TODOS', 'COMPRADORES', 'SEM_COMPRA', 'LEADS');
CREATE TYPE "StatusCampanha" AS ENUM ('RASCUNHO', 'AGENDADA', 'ENVIANDO', 'ENVIADA', 'CANCELADA');

-- AlterTable: descadastro de campanhas (aviso de pedido não depende disto)
ALTER TABLE "Cliente" ADD COLUMN "aceitaEmails" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CampanhaEmail" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "publico" "PublicoCampanha" NOT NULL DEFAULT 'TODOS',
    "status" "StatusCampanha" NOT NULL DEFAULT 'RASCUNHO',
    "agendadaPara" TIMESTAMP(3),
    "iniciadaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampanhaEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnvioCampanha" (
    "id" TEXT NOT NULL,
    "campanhaId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "enviadoEm" TIMESTAMP(3),
    "erro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvioCampanha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampanhaEmail_status_agendadaPara_idx" ON "CampanhaEmail"("status", "agendadaPara");
CREATE UNIQUE INDEX "EnvioCampanha_campanhaId_email_key" ON "EnvioCampanha"("campanhaId", "email");
CREATE INDEX "EnvioCampanha_campanhaId_enviadoEm_idx" ON "EnvioCampanha"("campanhaId", "enviadoEm");

-- AddForeignKey
ALTER TABLE "EnvioCampanha" ADD CONSTRAINT "EnvioCampanha_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "CampanhaEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
