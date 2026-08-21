-- CreateEnum
CREATE TYPE "SegurancaSmtp" AS ENUM ('STARTTLS', 'SSL', 'NENHUMA');

-- CreateTable
CREATE TABLE "ConfiguracaoEmail" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT NOT NULL,
    "porta" INTEGER NOT NULL DEFAULT 587,
    "seguranca" "SegurancaSmtp" NOT NULL DEFAULT 'STARTTLS',
    "usuario" TEXT NOT NULL,
    "senhaCriptografada" TEXT NOT NULL,
    "remetenteNome" TEXT NOT NULL,
    "remetenteEmail" TEXT NOT NULL,
    "responderPara" TEXT,
    "ultimoTesteEm" TIMESTAMP(3),
    "ultimoTesteOk" BOOLEAN,
    "ultimoTesteErro" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoEmail_pkey" PRIMARY KEY ("id")
);
