-- Consumo da IA (Gemini), contado pelo próprio site.
--
-- O Google não expõe o saldo de créditos para a chave da API: só no painel do
-- AI Studio, com login. Para mostrar gasto e saldo estimado em Configurações,
-- cada chamada grava tokens e custo.
CREATE TABLE "UsoIa" (
    "id" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tokensEntrada" INTEGER NOT NULL,
    "tokensSaida" INTEGER NOT NULL,
    "custoUsd" DECIMAL(12,6) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsoIa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsoIa_criadoEm_idx" ON "UsoIa"("criadoEm");

CREATE TABLE "ConfiguracaoIa" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "saldoUsd" DECIMAL(10,2),
    "saldoInformadoEm" TIMESTAMP(3),
    "alertaUsd" DECIMAL(10,2),
    "semCreditoEm" TIMESTAMP(3),
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoIa_pkey" PRIMARY KEY ("id")
);
