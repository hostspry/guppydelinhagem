-- Composição que cada anúncio do ML vende.
--
-- Sem ela, o estoque enviado a um anúncio de trio era o total de peixes do pool
-- (machos + fêmeas), e o pedido importado baixava sempre a receita do trio,
-- mesmo quando a venda era de macho.
ALTER TABLE "MercadoLivreAnuncio" ADD COLUMN "composicao" "TipoComposicao";

-- Espelho do prazo de envio mandado ao ML (peixe sai só na segunda).
ALTER TABLE "MercadoLivreAnuncio" ADD COLUMN "prazoEnvioDias" INTEGER;

-- Ligações que já existem: o título de peixe é montado com o nome da
-- composição (lib/mercadolivre/seo), então dá para ler de lá. Só preenche quando
-- o produto tem mesmo aquela composição; o resto fica nulo e cai na padrão.
UPDATE "MercadoLivreAnuncio" a
SET "composicao" = v."composicao"
FROM "Product" p, "ProductVariant" v
WHERE p."id" = a."productId"
  AND p."tipo" = 'PEIXE'
  AND v."productId" = p."id"
  AND a."composicao" IS NULL
  AND a."titulo" ~* (
    '\m' || CASE v."composicao"
      WHEN 'TRIO' THEN 'trio'
      WHEN 'CASAL' THEN 'casal'
      WHEN 'MACHO' THEN 'macho'
      WHEN 'FEMEA' THEN 'f[eê]mea'
      WHEN 'LOTE' THEN 'lote'
    END || '\M'
  );
