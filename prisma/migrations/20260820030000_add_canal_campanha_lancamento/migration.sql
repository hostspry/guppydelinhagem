-- CreateEnum
CREATE TYPE "CanalVenda" AS ENUM ('GOOGLE', 'SITE', 'INSTAGRAM', 'FACEBOOK', 'YOUTUBE', 'TIKTOK', 'WHATSAPP', 'MERCADO_LIVRE', 'OLX', 'INDICACAO', 'EVENTO', 'OUTRO');

-- AlterTable
ALTER TABLE "Lancamento" ADD COLUMN     "canal" "CanalVenda",
ADD COLUMN     "campanha" TEXT;

-- CreateIndex
CREATE INDEX "Lancamento_canal_idx" ON "Lancamento"("canal");

-- CreateIndex
CREATE INDEX "Lancamento_campanha_idx" ON "Lancamento"("campanha");

-- Categorias de ENTRADA que faltavam (venda por WhatsApp de cada pessoa,
-- leilão, rifa). Idempotente: ON CONFLICT pelo slug, então rodar de novo não
-- duplica nem sobrescreve o que o admin renomeou depois.
INSERT INTO "CategoriaFinanceira" ("id", "nome", "slug", "tipo", "sistema", "ordem", "ativa", "criadoEm")
VALUES
  (gen_random_uuid()::text, 'Venda WhatsApp — Manassés', 'venda-whatsapp-manasses', 'ENTRADA', false, 3, true, NOW()),
  (gen_random_uuid()::text, 'Venda WhatsApp — Lucas',    'venda-whatsapp-lucas',    'ENTRADA', false, 4, true, NOW()),
  (gen_random_uuid()::text, 'Leilão',                    'leilao',                  'ENTRADA', false, 5, true, NOW()),
  (gen_random_uuid()::text, 'Rifa',                      'rifa',                    'ENTRADA', false, 6, true, NOW())
ON CONFLICT ("slug") DO NOTHING;
