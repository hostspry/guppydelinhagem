-- Fecha a exposição dos pedidos JÁ existentes.
--
-- O número do pedido é sequencial, então qualquer um percorria /pedido/2026-0001,
-- 0002... e via itens e valores de cada venda. A página passou a exigir o token
-- do link para mostrar o resumo; sem este preenchimento, a proteção só valeria
-- para pedidos novos — ou seja, para nenhum dos que existem hoje.
--
-- gen_random_uuid() em vez de gen_random_bytes(): a segunda exige a extensão
-- pgcrypto, que não está instalada neste banco. O uuid v4 traz a mesma entropia
-- de 128 bits; tirar os hífens deixa no formato hex que o app já usa.
--
-- Efeito colateral aceito: um link de confirmação antigo, se alguém reabrir,
-- passa a mostrar só o andamento do pedido. O detalhe continua em Minha conta.
UPDATE "Order"
   SET "publicToken" = replace(gen_random_uuid()::text, '-', '')
 WHERE "publicToken" IS NULL;
