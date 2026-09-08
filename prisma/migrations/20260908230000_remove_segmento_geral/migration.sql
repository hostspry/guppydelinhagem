-- A gaveta "Geral" não corresponde ao negócio real.
--
-- A estufa é uma SOCIEDADE (dois sócios) e os peixes são dela; a loja de
-- aquarismo é projeto de um sócio só. Custo de estrutura (luz, água, internet,
-- aluguel, imposto) é custo da estufa, então precisa entrar no resultado da
-- sociedade — é esse número que os dois dividem. Uma terceira gaveta deixava
-- esse resultado incompleto de propósito.

-- ── 1. O que estava em GERAL passa a ser da estufa ──────────────────────────
UPDATE "Lancamento" SET "segmento" = 'PEIXES_VIVOS' WHERE "segmento" = 'GERAL';
UPDATE "RecorrenciaFinanceira" SET "segmento" = 'PEIXES_VIVOS' WHERE "segmento" = 'GERAL';
UPDATE "CategoriaFinanceira" SET "segmentoPadrao" = 'PEIXES_VIVOS' WHERE "segmentoPadrao" = 'GERAL';

-- Escopo dos membros: troca GERAL por PEIXES_VIVOS sem duplicar quem já tinha os
-- dois (o DISTINCT resolve).
UPDATE "User"
   SET "segmentosFinanceiros" = ARRAY(
         SELECT DISTINCT CASE WHEN s = 'GERAL' THEN 'PEIXES_VIVOS' ELSE s END
           FROM unnest("segmentosFinanceiros") AS s
       )::"SegmentoFinanceiro"[]
 WHERE 'GERAL' = ANY("segmentosFinanceiros");

-- ── 2. Enum sem GERAL ───────────────────────────────────────────────────────
-- Postgres não remove valor de enum: recria o tipo e reaponta as colunas. Os
-- defaults saem antes e voltam depois porque dependem do tipo antigo.
ALTER TABLE "Lancamento" ALTER COLUMN "segmento" DROP DEFAULT;
ALTER TABLE "RecorrenciaFinanceira" ALTER COLUMN "segmento" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "segmentosFinanceiros" DROP DEFAULT;

ALTER TYPE "SegmentoFinanceiro" RENAME TO "SegmentoFinanceiro_old";
CREATE TYPE "SegmentoFinanceiro" AS ENUM ('PEIXES_VIVOS', 'PRODUTOS');

ALTER TABLE "Lancamento"
  ALTER COLUMN "segmento" TYPE "SegmentoFinanceiro"
  USING "segmento"::text::"SegmentoFinanceiro";

ALTER TABLE "RecorrenciaFinanceira"
  ALTER COLUMN "segmento" TYPE "SegmentoFinanceiro"
  USING "segmento"::text::"SegmentoFinanceiro";

ALTER TABLE "CategoriaFinanceira"
  ALTER COLUMN "segmentoPadrao" TYPE "SegmentoFinanceiro"
  USING "segmentoPadrao"::text::"SegmentoFinanceiro";

ALTER TABLE "User"
  ALTER COLUMN "segmentosFinanceiros" TYPE "SegmentoFinanceiro"[]
  USING "segmentosFinanceiros"::text[]::"SegmentoFinanceiro"[];

ALTER TABLE "Lancamento" ALTER COLUMN "segmento" SET DEFAULT 'PEIXES_VIVOS';
ALTER TABLE "RecorrenciaFinanceira" ALTER COLUMN "segmento" SET DEFAULT 'PEIXES_VIVOS';
ALTER TABLE "User" ALTER COLUMN "segmentosFinanceiros" SET DEFAULT ARRAY[]::"SegmentoFinanceiro"[];

DROP TYPE "SegmentoFinanceiro_old";

-- ── 3. Categorias de estrutura passam a sugerir a estufa ────────────────────
-- Estrutura física fica na estufa: é ela que consome luz, água e internet.
UPDATE "CategoriaFinanceira"
   SET "segmentoPadrao" = 'PEIXES_VIVOS'
 WHERE slug IN ('energia', 'agua', 'internet', 'equipamentos', 'retirada-dono');

-- Imposto NÃO tem sugestão: o da estufa é da sociedade, o da venda de produtos é
-- do projeto de um sócio só. Sugerir um lado faria o formulário empurrar imposto
-- de produto para dentro da conta que os dois dividem. Mesma coisa no marketing,
-- que pode anunciar tanto peixe quanto acessório.
UPDATE "CategoriaFinanceira"
   SET "segmentoPadrao" = NULL
 WHERE slug IN ('impostos', 'marketing');

-- Aluguel ainda não existia como categoria e é custo de estufa.
INSERT INTO "CategoriaFinanceira" (id, nome, slug, tipo, sistema, "segmentoPadrao", ordem, ativa, "criadoEm")
SELECT 'cat-aluguel-estufa', 'Aluguel', 'aluguel', 'SAIDA', false, 'PEIXES_VIVOS',
       (SELECT COALESCE(MAX(ordem), 0) + 1 FROM "CategoriaFinanceira"), true, now()
 WHERE NOT EXISTS (SELECT 1 FROM "CategoriaFinanceira" WHERE slug = 'aluguel');
