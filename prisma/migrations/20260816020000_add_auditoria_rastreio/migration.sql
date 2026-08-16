-- CreateTable
CREATE TABLE "AuditoriaAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userNome" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "userPapel" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "descricao" TEXT NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visitante" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "primeiroAcesso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoAcesso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalSessoes" INTEGER NOT NULL DEFAULT 0,
    "totalEventos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Visitante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoVisita" (
    "id" TEXT NOT NULL,
    "visitanteId" TEXT NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaAtividade" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "consentimento" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" TEXT,
    "dispositivo" TEXT,
    "navegador" TEXT,
    "sistema" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "paginaEntrada" TEXT,
    "cidade" TEXT,
    "regiao" TEXT,
    "pais" TEXT,
    "provedor" TEXT,

    CONSTRAINT "SessaoVisita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoVisitante" (
    "id" TEXT NOT NULL,
    "visitanteId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT,
    "titulo" TEXT,
    "produtoId" TEXT,
    "produtoNome" TEXT,
    "variantId" TEXT,
    "composicao" TEXT,
    "quantidade" INTEGER,
    "valor" DECIMAL(10,2),
    "busca" TEXT,
    "meta" JSONB,

    CONSTRAINT "EventoVisitante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoIp" (
    "ip" TEXT NOT NULL,
    "cidade" TEXT,
    "regiao" TEXT,
    "pais" TEXT,
    "provedor" TEXT,
    "falhou" BOOLEAN NOT NULL DEFAULT false,
    "consultadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoIp_pkey" PRIMARY KEY ("ip")
);

-- CreateIndex
CREATE INDEX "AuditoriaAdmin_ocorridoEm_idx" ON "AuditoriaAdmin"("ocorridoEm");

-- CreateIndex
CREATE INDEX "AuditoriaAdmin_userId_ocorridoEm_idx" ON "AuditoriaAdmin"("userId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "AuditoriaAdmin_acao_ocorridoEm_idx" ON "AuditoriaAdmin"("acao", "ocorridoEm");

-- CreateIndex
CREATE INDEX "AuditoriaAdmin_entidade_entidadeId_idx" ON "AuditoriaAdmin"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "Visitante_ultimoAcesso_idx" ON "Visitante"("ultimoAcesso");

-- CreateIndex
CREATE INDEX "Visitante_userId_idx" ON "Visitante"("userId");

-- CreateIndex
CREATE INDEX "SessaoVisita_visitanteId_iniciadaEm_idx" ON "SessaoVisita"("visitanteId", "iniciadaEm");

-- CreateIndex
CREATE INDEX "SessaoVisita_iniciadaEm_idx" ON "SessaoVisita"("iniciadaEm");

-- CreateIndex
CREATE INDEX "EventoVisitante_visitanteId_ocorridoEm_idx" ON "EventoVisitante"("visitanteId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "EventoVisitante_sessaoId_ocorridoEm_idx" ON "EventoVisitante"("sessaoId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "EventoVisitante_tipo_ocorridoEm_idx" ON "EventoVisitante"("tipo", "ocorridoEm");

-- CreateIndex
CREATE INDEX "EventoVisitante_produtoId_ocorridoEm_idx" ON "EventoVisitante"("produtoId", "ocorridoEm");

-- CreateIndex
CREATE INDEX "EventoVisitante_ocorridoEm_idx" ON "EventoVisitante"("ocorridoEm");

-- AddForeignKey
ALTER TABLE "AuditoriaAdmin" ADD CONSTRAINT "AuditoriaAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visitante" ADD CONSTRAINT "Visitante_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoVisita" ADD CONSTRAINT "SessaoVisita_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "Visitante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoVisitante" ADD CONSTRAINT "EventoVisitante_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "Visitante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoVisitante" ADD CONSTRAINT "EventoVisitante_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "SessaoVisita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

