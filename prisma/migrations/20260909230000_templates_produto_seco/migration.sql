-- Mensagens do pedido SEM bicho vivo.
--
-- O texto de "pedido enviado" ensina a aclimatar o saquinho com oxigênio, e o de
-- "pagamento confirmado" promete separar o peixe com calma. Quem comprou uma
-- criadeira recebeu isso e ficou sem entender. Peixe e criadeira saem da mesma
-- loja, mas não são a mesma entrega.
--
-- Duas mensagens novas, escolhidas pelo tipo do que foi comprado. Idempotente:
-- ON CONFLICT não sobrescreve o que o dono já tiver escrito.
INSERT INTO "TemplateEmail"
  ("chave","assunto","titulo","corpo","ativo","assuntoPadrao","tituloPadrao","corpoPadrao","atualizadoEm")
VALUES
  ('pedido-pago-seco',
   'Pagamento confirmado — pedido {{numero}}',
   'Pagamento confirmado!',
   'Oi {{nome}}, seu pagamento entrou e o pedido **{{numero}}** já está na fila de separação.

{{itens}}

Total: **{{total}}**

Vou embalar com cuidado e te mando o código de rastreio assim que despachar.

{{botao_acompanhar}}',
   true,
   'Pagamento confirmado — pedido {{numero}}',
   'Pagamento confirmado!',
   'Oi {{nome}}, seu pagamento entrou e o pedido **{{numero}}** já está na fila de separação.

{{itens}}

Total: **{{total}}**

Vou embalar com cuidado e te mando o código de rastreio assim que despachar.

{{botao_acompanhar}}',
   NOW()),

  ('pedido-enviado-seco',
   'Pedido {{numero}} enviado',
   'Seu pedido saiu para entrega',
   'Oi {{nome}}, o pedido **{{numero}}** foi despachado {{transportadora}}.

{{caixa_rastreio}}

{{botao_rastrear}}

O prazo que aparece no rastreio conta em dias úteis, a partir da postagem.

Qualquer coisa no caminho, me chama no WhatsApp: 28 999179747

Obrigado por escolher A Marchezi Guppy Farm.',
   true,
   'Pedido {{numero}} enviado',
   'Seu pedido saiu para entrega',
   'Oi {{nome}}, o pedido **{{numero}}** foi despachado {{transportadora}}.

{{caixa_rastreio}}

{{botao_rastrear}}

O prazo que aparece no rastreio conta em dias úteis, a partir da postagem.

Qualquer coisa no caminho, me chama no WhatsApp: 28 999179747

Obrigado por escolher A Marchezi Guppy Farm.',
   NOW())
ON CONFLICT ("chave") DO NOTHING;
