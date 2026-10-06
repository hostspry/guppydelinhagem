-- Rastro completo do cartão. Até aqui só ficavam registradas a falha do
-- formulário do MP, a cobrança que não saía e a recusa síncrona do checkout.
-- O resto sumia: campo inválido no checkout, limite de tentativas, 3DS, recusa
-- que chega pelo webhook (link de cobrança, Checkout Pro) e o fluxo inteiro do
-- link de cobrança. E não havia como saber se alguém chegava a tentar.
--
-- VALIDACAO: o site barrou antes de cobrar. ABERTO e ENVIO são funil (o
-- formulário apareceu / o cliente clicou em Pagar) e não geram aviso.
ALTER TYPE "EtapaCartao" ADD VALUE 'VALIDACAO';
ALTER TYPE "EtapaCartao" ADD VALUE 'ABERTO';
ALTER TYPE "EtapaCartao" ADD VALUE 'ENVIO';

ALTER TABLE "TentativaCartao" ADD COLUMN "fluxo" TEXT;
ALTER TABLE "TentativaCartao" ADD COLUMN "pagamentoExternoId" TEXT;
CREATE INDEX "TentativaCartao_pagamentoExternoId_idx" ON "TentativaCartao"("pagamentoExternoId");
