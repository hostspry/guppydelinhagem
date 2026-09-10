-- Rastro das tentativas de cartão que não viram pagamento.
--
-- Um cliente avisou que o cartão "deu recusado" e teve que pagar no Pix. Fomos
-- procurar o que houve e não havia nada: nenhuma linha em "Pagamento", nenhum
-- pagamento no Mercado Pago e nenhuma linha de log. A tentativa morreu no
-- navegador (SDK, Brick ou a chamada da action) e o site não guardava isso em
-- lugar nenhum, então não dava para saber se o problema era o cartão do cliente
-- ou defeito nosso.
--
-- Esta tabela guarda só o motivo e o contexto. NUNCA número de cartão, CVV ou
-- token — nada disso chega ao servidor.
CREATE TYPE "EtapaCartao" AS ENUM ('SDK', 'FORMULARIO', 'COBRANCA', 'RECUSA');

CREATE TABLE "TentativaCartao" (
  "id"           TEXT NOT NULL,
  "etapa"        "EtapaCartao" NOT NULL,
  "provider"     "ProviderPagamento",
  "mensagem"     TEXT NOT NULL,
  "statusDetail" TEXT,
  "valor"        DECIMAL(10,2),
  "parcelas"     INTEGER,
  "deviceOk"     BOOLEAN NOT NULL DEFAULT false,
  "orderId"      TEXT,
  "numero"       TEXT,
  "email"        TEXT,
  "telefone"     TEXT,
  "userAgent"    TEXT,
  "criadoEm"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TentativaCartao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TentativaCartao_criadoEm_idx" ON "TentativaCartao" ("criadoEm");
CREATE INDEX "TentativaCartao_etapa_criadoEm_idx" ON "TentativaCartao" ("etapa", "criadoEm");
