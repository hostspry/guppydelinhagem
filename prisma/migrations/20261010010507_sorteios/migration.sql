-- Módulo de sorteios: só cria tabelas e tipos novos. Nenhuma tabela existente
-- é alterada (a relação com User vive só nas tabelas novas).

-- CreateEnum
CREATE TYPE "StatusSorteio" AS ENUM ('CONFERENCIA', 'HOMOLOGADO', 'REALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ClassificacaoLance" AS ENUM ('VALIDO', 'INVALIDO', 'REVISAR');

-- CreateEnum
CREATE TYPE "TipoLance" AS ENUM ('NORMAL', 'XEQUE_MATE', 'MESTRE_CRIADOR');

-- CreateEnum
CREATE TYPE "StatusVerificacaoTelefone" AS ENUM ('PENDENTE', 'CONFIRMADA', 'EXPIRADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Sorteio" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "organizador" TEXT NOT NULL,
    "eventoOrigem" TEXT,
    "dataEvento" TIMESTAMP(3),
    "premio" TEXT NOT NULL,
    "descricao" TEXT,
    "regras" TEXT,
    "imagemUrl" TEXT,
    "transmissaoUrl" TEXT,
    "dataSorteio" TIMESTAMP(3),
    "status" "StatusSorteio" NOT NULL DEFAULT 'CONFERENCIA',
    "publico" BOOLEAN NOT NULL DEFAULT false,
    "homologadoEm" TIMESTAMP(3),
    "homologadoPorNome" TEXT,
    "totalBilhetes" INTEGER,
    "hashLista" TEXT,
    "listaCongelada" TEXT,
    "modoSorteio" TEXT NOT NULL DEFAULT 'ELETRONICO',
    "concursoLoteria" TEXT,
    "premiosLoteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "realizadoEm" TIMESTAMP(3),
    "realizadoPorNome" TEXT,
    "realizadoPorId" TEXT,
    "metodoSorteio" TEXT,
    "bilheteVencedor" INTEGER,
    "participanteVencedorId" TEXT,
    "vencedorPublico" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sorteio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipanteSorteio" (
    "id" TEXT NOT NULL,
    "sorteioId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "nomeOrigem" TEXT NOT NULL,
    "telefone" TEXT,
    "ordem" INTEGER NOT NULL,
    "chances" INTEGER NOT NULL,
    "bilheteInicio" INTEGER,
    "bilheteFim" INTEGER,
    "userId" TEXT,
    "vinculadoEm" TIMESTAMP(3),
    "vinculoOrigem" TEXT,
    "avisoVistoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipanteSorteio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanceSorteio" (
    "id" TEXT NOT NULL,
    "sorteioId" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "loteRotulo" TEXT,
    "sequencia" INTEGER NOT NULL,
    "horario" TIMESTAMP(3),
    "encerramento" TIMESTAMP(3),
    "autor" TEXT NOT NULL,
    "telefone" TEXT,
    "valor" DECIMAL(10,2),
    "tipo" "TipoLance" NOT NULL DEFAULT 'NORMAL',
    "textoOriginal" TEXT,
    "classificacaoMotor" "ClassificacaoLance" NOT NULL,
    "classificacaoPlanilha" "ClassificacaoLance",
    "classificacao" "ClassificacaoLance" NOT NULL,
    "motivo" TEXT,
    "decididoPorNome" TEXT,
    "decididoEm" TIMESTAMP(3),
    "participanteId" TEXT,
    "chaveImportacao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LanceSorteio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoSorteio" (
    "id" TEXT NOT NULL,
    "sorteioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "justificativa" TEXT,
    "dados" JSONB,
    "atorId" TEXT,
    "atorNome" TEXT NOT NULL,
    "hashAnterior" TEXT,
    "hash" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoSorteio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelefoneVerificado" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "verificadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo" TEXT NOT NULL,
    "confirmadoPorNome" TEXT,

    CONSTRAINT "TelefoneVerificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificacaoTelefone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "codigoCifrado" TEXT NOT NULL,
    "status" "StatusVerificacaoTelefone" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "confirmadaEm" TIMESTAMP(3),
    "confirmadaPorNome" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificacaoTelefone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sorteio_slug_key" ON "Sorteio"("slug");

-- CreateIndex
CREATE INDEX "Sorteio_status_idx" ON "Sorteio"("status");

-- CreateIndex
CREATE INDEX "Sorteio_publico_dataSorteio_idx" ON "Sorteio"("publico", "dataSorteio");

-- CreateIndex
CREATE INDEX "ParticipanteSorteio_telefone_idx" ON "ParticipanteSorteio"("telefone");

-- CreateIndex
CREATE INDEX "ParticipanteSorteio_userId_idx" ON "ParticipanteSorteio"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipanteSorteio_sorteioId_chave_key" ON "ParticipanteSorteio"("sorteioId", "chave");

-- CreateIndex
CREATE INDEX "LanceSorteio_sorteioId_loteId_sequencia_idx" ON "LanceSorteio"("sorteioId", "loteId", "sequencia");

-- CreateIndex
CREATE INDEX "LanceSorteio_participanteId_idx" ON "LanceSorteio"("participanteId");

-- CreateIndex
CREATE UNIQUE INDEX "LanceSorteio_sorteioId_chaveImportacao_key" ON "LanceSorteio"("sorteioId", "chaveImportacao");

-- CreateIndex
CREATE INDEX "EventoSorteio_sorteioId_ocorridoEm_idx" ON "EventoSorteio"("sorteioId", "ocorridoEm");

-- CreateIndex
CREATE UNIQUE INDEX "TelefoneVerificado_telefone_key" ON "TelefoneVerificado"("telefone");

-- CreateIndex
CREATE INDEX "TelefoneVerificado_userId_idx" ON "TelefoneVerificado"("userId");

-- CreateIndex
CREATE INDEX "VerificacaoTelefone_status_criadoEm_idx" ON "VerificacaoTelefone"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "VerificacaoTelefone_userId_idx" ON "VerificacaoTelefone"("userId");

-- CreateIndex
CREATE INDEX "VerificacaoTelefone_telefone_idx" ON "VerificacaoTelefone"("telefone");

-- AddForeignKey
ALTER TABLE "ParticipanteSorteio" ADD CONSTRAINT "ParticipanteSorteio_sorteioId_fkey" FOREIGN KEY ("sorteioId") REFERENCES "Sorteio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipanteSorteio" ADD CONSTRAINT "ParticipanteSorteio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanceSorteio" ADD CONSTRAINT "LanceSorteio_sorteioId_fkey" FOREIGN KEY ("sorteioId") REFERENCES "Sorteio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanceSorteio" ADD CONSTRAINT "LanceSorteio_participanteId_fkey" FOREIGN KEY ("participanteId") REFERENCES "ParticipanteSorteio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoSorteio" ADD CONSTRAINT "EventoSorteio_sorteioId_fkey" FOREIGN KEY ("sorteioId") REFERENCES "Sorteio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelefoneVerificado" ADD CONSTRAINT "TelefoneVerificado_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificacaoTelefone" ADD CONSTRAINT "VerificacaoTelefone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
