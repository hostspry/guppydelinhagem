-- Envio aéreo (Gollog): aeroporto de retirada, quem retira e a confirmação que
-- o cliente faz pelo link do e-mail.
ALTER TABLE "Order" ADD COLUMN "aeroportoDestino" VARCHAR(3);
ALTER TABLE "Order" ADD COLUMN "recebedorNome" TEXT;
ALTER TABLE "Order" ADD COLUMN "recebedorCpf" TEXT;
ALTER TABLE "Order" ADD COLUMN "recebedorTelefone" TEXT;
ALTER TABLE "Order" ADD COLUMN "confirmacaoEnvioToken" TEXT;
ALTER TABLE "Order" ADD COLUMN "confirmacaoEnvioPedidaEm" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "confirmacaoEnvioEm" TIMESTAMP(3);
CREATE UNIQUE INDEX "Order_confirmacaoEnvioToken_key" ON "Order"("confirmacaoEnvioToken");

-- E-mail que pede a confirmação. ON CONFLICT não mexe no texto que o dono já
-- tiver escrito.
INSERT INTO "TemplateEmail"
  ("chave","assunto","titulo","corpo","ativo","assuntoPadrao","tituloPadrao","corpoPadrao","atualizadoEm")
VALUES
  ('envio-aereo-confirmar',
   'Pedido {{numero}}: confirme onde vai retirar',
   'Confirme onde retirar seus peixes',
   'Oi {{nome}}, seu pedido **{{numero}}** vai de avião pela Gollog. A caixa não é entregue em casa: ela fica na base da Gollog no aeroporto, e alguém precisa ir buscar.

Antes de despachar, preciso que você confirme três coisas: seu endereço e CPF, que vão no documento de envio; em qual aeroporto você vai retirar; e quem vai buscar a caixa, se não for você.

{{botao_confirmar}}

Leva um minuto. Sem essa confirmação eu não consigo despachar, e peixe vivo não pode ficar esperando no balcão. Na retirada, leve um documento com foto.

Se o botão não abrir, copie este endereço no navegador: {{link}}',
   true,
   'Pedido {{numero}}: confirme onde vai retirar',
   'Confirme onde retirar seus peixes',
   'Oi {{nome}}, seu pedido **{{numero}}** vai de avião pela Gollog. A caixa não é entregue em casa: ela fica na base da Gollog no aeroporto, e alguém precisa ir buscar.

Antes de despachar, preciso que você confirme três coisas: seu endereço e CPF, que vão no documento de envio; em qual aeroporto você vai retirar; e quem vai buscar a caixa, se não for você.

{{botao_confirmar}}

Leva um minuto. Sem essa confirmação eu não consigo despachar, e peixe vivo não pode ficar esperando no balcão. Na retirada, leve um documento com foto.

Se o botão não abrir, copie este endereço no navegador: {{link}}',
   CURRENT_TIMESTAMP)
ON CONFLICT ("chave") DO NOTHING;
