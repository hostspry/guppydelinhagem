-- "Outras entradas" é o balde do que não se encaixa: tem que ficar no fim da
-- lista, não no meio das categorias de venda que foram criadas depois dela.
UPDATE "CategoriaFinanceira" SET "ordem" = 20 WHERE "slug" = 'outras-entradas';
