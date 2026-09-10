-- Costura entre o visitante anônimo e o cliente.
--
-- O rastreio já ligava visitante a User, mas quase ninguém cria conta: a loja
-- vende por WhatsApp e por checkout sem cadastro, e em 25 dias houve 5 logins
-- para 1.444 visitantes. O vínculo que serve é com Cliente.
--
-- Sem unique: a mesma pessoa no celular e no computador são dois visitantes
-- apontando para o mesmo cliente — e juntar as duas navegações num histórico só
-- é justamente o objetivo.
ALTER TABLE "Visitante"
  ADD COLUMN IF NOT EXISTS "clienteId" TEXT,
  ADD COLUMN IF NOT EXISTS "identificadoEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "identificadoPor" TEXT;

CREATE INDEX IF NOT EXISTS "Visitante_clienteId_idx" ON "Visitante" ("clienteId");

ALTER TABLE "Visitante" DROP CONSTRAINT IF EXISTS "Visitante_clienteId_fkey";
ALTER TABLE "Visitante"
  ADD CONSTRAINT "Visitante_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Aproveita o que já é certo: visitante que fez login tem User, e alguns Users
-- já têm Cliente. É ligação exata, sem adivinhação por IP ou por nome parecido.
UPDATE "Visitante" v
SET "clienteId" = c."id",
    "identificadoEm" = COALESCE(v."identificadoEm", v."ultimoAcesso"),
    "identificadoPor" = COALESCE(v."identificadoPor", 'login')
FROM "Cliente" c
WHERE c."userId" = v."userId"
  AND v."userId" IS NOT NULL
  AND v."clienteId" IS NULL;
