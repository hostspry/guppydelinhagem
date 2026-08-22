-- Quinta mensagem: o acesso que a loja cria para o cliente da venda direta.
INSERT INTO "TemplateEmail"
  ("chave","assunto","titulo","corpo","ativo","assuntoPadrao","tituloPadrao","corpoPadrao","atualizadoEm")
VALUES
  ('acesso-cliente',
   'Seu acesso ao site — Guppy de Linhagem',
   'Seu acesso está pronto',
   'Oi {{nome}}, criei seu acesso no site para você acompanhar seus pedidos e o rastreio da entrega quando eu despachar.

{{caixa_acesso}}

{{botao_entrar}}

Na primeira entrada o site pede para você criar a sua própria senha. A que está aí em cima vale só para essa primeira vez.

Se você não pediu este acesso, é só ignorar este e-mail.',
   true,
   'Seu acesso ao site — Guppy de Linhagem',
   'Seu acesso está pronto',
   'Oi {{nome}}, criei seu acesso no site para você acompanhar seus pedidos e o rastreio da entrega quando eu despachar.

{{caixa_acesso}}

{{botao_entrar}}

Na primeira entrada o site pede para você criar a sua própria senha. A que está aí em cima vale só para essa primeira vez.

Se você não pediu este acesso, é só ignorar este e-mail.',
   NOW())
ON CONFLICT ("chave") DO NOTHING;
