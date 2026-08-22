-- Colunas do texto de fábrica: referência do "voltar ao texto padrão".
-- Entram com default vazio para a tabela existente aceitar, e o default cai logo
-- depois — a partir daqui toda linha nasce com o padrão preenchido.
ALTER TABLE "TemplateEmail" ADD COLUMN "assuntoPadrao" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TemplateEmail" ADD COLUMN "tituloPadrao" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TemplateEmail" ADD COLUMN "corpoPadrao" TEXT NOT NULL DEFAULT '';

-- Os textos saíram do código e passam a morar aqui. Idempotente: ON CONFLICT
-- não sobrescreve o que o dono já tiver escrito.
INSERT INTO "TemplateEmail"
  ("chave","assunto","titulo","corpo","ativo","assuntoPadrao","tituloPadrao","corpoPadrao","atualizadoEm")
VALUES
  ('pedido-pago',
   'Pagamento confirmado — pedido {{numero}}',
   'Pagamento confirmado!',
   'Oi {{nome}}, seu pagamento entrou e o pedido **{{numero}}** já está na fila de separação.

{{itens}}

Total: **{{total}}**

Assim que eu despachar, te mando o código de rastreio por aqui. Peixe vivo eu separo com calma e embalo com oxigênio no mesmo dia do envio.

{{botao_acompanhar}}',
   true,
   'Pagamento confirmado — pedido {{numero}}',
   'Pagamento confirmado!',
   'Oi {{nome}}, seu pagamento entrou e o pedido **{{numero}}** já está na fila de separação.

{{itens}}

Total: **{{total}}**

Assim que eu despachar, te mando o código de rastreio por aqui. Peixe vivo eu separo com calma e embalo com oxigênio no mesmo dia do envio.

{{botao_acompanhar}}',
   NOW()),

  ('pedido-pago-retirada',
   'Pagamento confirmado — pedido {{numero}}',
   'Pagamento confirmado!',
   'Oi {{nome}}, seu pagamento entrou e o pedido **{{numero}}** já está separado no seu nome.

{{itens}}

Total: **{{total}}**

Como você escolheu retirar pessoalmente, é só combinar o horário comigo pelo WhatsApp.

{{botao_acompanhar}}',
   true,
   'Pagamento confirmado — pedido {{numero}}',
   'Pagamento confirmado!',
   'Oi {{nome}}, seu pagamento entrou e o pedido **{{numero}}** já está separado no seu nome.

{{itens}}

Total: **{{total}}**

Como você escolheu retirar pessoalmente, é só combinar o horário comigo pelo WhatsApp.

{{botao_acompanhar}}',
   NOW()),

  ('pedido-enviado',
   'Pedido {{numero}} enviado',
   'Seu pedido saiu para entrega',
   'Oi {{nome}}, o pedido **{{numero}}** foi despachado {{transportadora}}.

{{caixa_rastreio}}

{{botao_rastrear}}

Peixe viaja embalado com oxigênio. Quando chegar, deixe o saquinho fechado boiando no aquário por uns 20 minutos antes de abrir, para a temperatura igualar.

Qualquer coisa no caminho, me chama no WhatsApp.',
   true,
   'Pedido {{numero}} enviado',
   'Seu pedido saiu para entrega',
   'Oi {{nome}}, o pedido **{{numero}}** foi despachado {{transportadora}}.

{{caixa_rastreio}}

{{botao_rastrear}}

Peixe viaja embalado com oxigênio. Quando chegar, deixe o saquinho fechado boiando no aquário por uns 20 minutos antes de abrir, para a temperatura igualar.

Qualquer coisa no caminho, me chama no WhatsApp.',
   NOW()),

  ('cobranca-paga',
   'Pagamento confirmado — Guppy de Linhagem',
   'Pagamento confirmado',
   'Oi {{nome}}, recebi seu pagamento de **{{total}}**. Obrigado!

Qualquer coisa, é só responder este e-mail.',
   true,
   'Pagamento confirmado — Guppy de Linhagem',
   'Pagamento confirmado',
   'Oi {{nome}}, recebi seu pagamento de **{{total}}**. Obrigado!

Qualquer coisa, é só responder este e-mail.',
   NOW())
ON CONFLICT ("chave") DO NOTHING;

ALTER TABLE "TemplateEmail" ALTER COLUMN "assuntoPadrao" DROP DEFAULT;
ALTER TABLE "TemplateEmail" ALTER COLUMN "tituloPadrao" DROP DEFAULT;
ALTER TABLE "TemplateEmail" ALTER COLUMN "corpoPadrao" DROP DEFAULT;
