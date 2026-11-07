-- E-mail de cobrança do leilão: quando saiu (para não repetir sem querer) e o
-- texto de fábrica da mensagem, aprovado pelo dono em 07/11/2026.
ALTER TABLE "Order" ADD COLUMN "cobrancaEmailEm" TIMESTAMP(3);

INSERT INTO "TemplateEmail"
  ("chave","assunto","titulo","corpo","ativo","assuntoPadrao","tituloPadrao","corpoPadrao","atualizadoEm")
VALUES
  ('leilao-cobranca',
   'Seus lotes do {{leilao}} e o link para pagar',
   'Parabéns pelo arremate!',
   'Oi {{nome}}, obrigado por participar do **{{leilao}}** de {{data_leilao}}. Estes são os lotes que você arrematou:

{{lotes}}

Total dos lotes: **{{subtotal}}**

**Promoção Black Novembro:** seu menor arremate foi de **{{menor_lance}}**, então você pode levar até 5 linhagens a mais por {{menor_lance}} cada. Se quiser aproveitar, me chame no WhatsApp antes de pagar, que eu coloco as linhagens na sua cobrança e tudo vai na mesma caixa, com um frete só.

{{frete}}

{{botao_pagar}}

Se o botão não abrir, copie este endereço no navegador: {{link}}

Qualquer dúvida, é só responder este e-mail ou me chamar no WhatsApp.

Obrigado por escolher A Marchezi Guppy Farm.',
   true,
   'Seus lotes do {{leilao}} e o link para pagar',
   'Parabéns pelo arremate!',
   'Oi {{nome}}, obrigado por participar do **{{leilao}}** de {{data_leilao}}. Estes são os lotes que você arrematou:

{{lotes}}

Total dos lotes: **{{subtotal}}**

**Promoção Black Novembro:** seu menor arremate foi de **{{menor_lance}}**, então você pode levar até 5 linhagens a mais por {{menor_lance}} cada. Se quiser aproveitar, me chame no WhatsApp antes de pagar, que eu coloco as linhagens na sua cobrança e tudo vai na mesma caixa, com um frete só.

{{frete}}

{{botao_pagar}}

Se o botão não abrir, copie este endereço no navegador: {{link}}

Qualquer dúvida, é só responder este e-mail ou me chamar no WhatsApp.

Obrigado por escolher A Marchezi Guppy Farm.',
   NOW())
ON CONFLICT ("chave") DO NOTHING;
