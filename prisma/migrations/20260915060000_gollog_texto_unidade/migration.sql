-- A retirada pode ser numa loja da Gollog, não só no aeroporto (Sinop, por
-- exemplo). Ajusta o texto de fábrica do e-mail. O texto em uso só muda se o
-- dono ainda não tiver editado.
UPDATE "TemplateEmail"
SET "corpo" = REPLACE(REPLACE("corpo",
      'ela fica na base da Gollog no aeroporto, e alguém precisa ir buscar',
      'ela fica numa unidade da Gollog, e alguém precisa ir buscar'),
      'em qual aeroporto você vai retirar',
      'em qual unidade da Gollog você vai retirar')
WHERE "chave" = 'envio-aereo-confirmar' AND "corpo" = "corpoPadrao";

UPDATE "TemplateEmail"
SET "corpoPadrao" = REPLACE(REPLACE("corpoPadrao",
      'ela fica na base da Gollog no aeroporto, e alguém precisa ir buscar',
      'ela fica numa unidade da Gollog, e alguém precisa ir buscar'),
      'em qual aeroporto você vai retirar',
      'em qual unidade da Gollog você vai retirar')
WHERE "chave" = 'envio-aereo-confirmar';
