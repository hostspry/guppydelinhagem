-- Registro do e-mail "encomenda postada": quando saiu, para quem e, se falhou, por quê.
ALTER TABLE "Order" ADD COLUMN "emailEnvioEm" TIMESTAMP(3),
ADD COLUMN "emailEnvioPara" TEXT,
ADD COLUMN "emailEnvioErro" TEXT;
