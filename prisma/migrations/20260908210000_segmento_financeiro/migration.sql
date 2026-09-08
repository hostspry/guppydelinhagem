-- Financeiro dividido por unidade de negócio: a estufa (peixes vivos), a loja de
-- aquarismo (produtos) e o que serve os dois (geral). É também a divisória de
-- privacidade entre sócios: quem cuida só da estufa não vê o caixa da loja.

CREATE TYPE "SegmentoFinanceiro" AS ENUM ('GERAL', 'PEIXES_VIVOS', 'PRODUTOS');

ALTER TABLE "CategoriaFinanceira"
  ADD COLUMN IF NOT EXISTS "segmentoPadrao" "SegmentoFinanceiro";

ALTER TABLE "RecorrenciaFinanceira"
  ADD COLUMN IF NOT EXISTS "segmento" "SegmentoFinanceiro" NOT NULL DEFAULT 'GERAL';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "segmentosFinanceiros" "SegmentoFinanceiro"[] DEFAULT ARRAY[]::"SegmentoFinanceiro"[];

-- Nasce em PEIXES_VIVOS: até aqui a operação era só a estufa, então esse é o
-- valor historicamente correto para as linhas que já existem.
ALTER TABLE "Lancamento"
  ADD COLUMN IF NOT EXISTS "segmento" "SegmentoFinanceiro" NOT NULL DEFAULT 'PEIXES_VIVOS';

CREATE INDEX IF NOT EXISTS "Lancamento_segmento_status_data_idx"
  ON "Lancamento" ("segmento", "status", "data");

-- ── Classificação do que já existe ──────────────────────────────────────────
-- Custo de estrutura serve os dois negócios: vai para GERAL. O resto (venda,
-- ração, medicamento, matriz, embalagem, taxa, frete) é estufa e fica como está.
UPDATE "Lancamento" l
   SET "segmento" = 'GERAL'
  FROM "CategoriaFinanceira" c
 WHERE l."categoriaId" = c.id
   AND c.slug IN ('energia', 'agua', 'internet', 'impostos', 'equipamentos', 'retirada-dono');

-- Mesma régua para as contas que se repetem todo mês.
UPDATE "RecorrenciaFinanceira" r
   SET "segmento" = 'PEIXES_VIVOS'
  FROM "CategoriaFinanceira" c
 WHERE r."categoriaId" = c.id
   AND c.slug NOT IN ('energia', 'agua', 'internet', 'impostos', 'equipamentos', 'retirada-dono');

-- Sugestão de segmento por categoria, para o formulário já vir preenchido.
UPDATE "CategoriaFinanceira"
   SET "segmentoPadrao" = 'GERAL'
 WHERE slug IN ('energia', 'agua', 'internet', 'impostos', 'equipamentos', 'retirada-dono', 'marketing');

UPDATE "CategoriaFinanceira"
   SET "segmentoPadrao" = 'PEIXES_VIVOS'
 WHERE slug IN ('racao', 'medicamentos', 'matrizes', 'leilao', 'rifa');
