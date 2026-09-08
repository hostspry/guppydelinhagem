-- Cargos editáveis no painel.
--
-- As permissões eram três listas fixas no código (EDITOR/ADMIN/SUPER_ADMIN), o
-- que obrigava um deploy para cada arranjo novo. Com a estufa virando sociedade
-- e a loja de aquarismo sendo projeto de um sócio só, "admin da estufa" e "admin
-- de produtos" passaram a ser arranjos do dia a dia — precisam existir sem
-- precisar de programador.

CREATE TABLE "Cargo" (
  "id"                   TEXT PRIMARY KEY,
  "nome"                 TEXT NOT NULL UNIQUE,
  "descricao"            TEXT,
  "permissoes"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "segmentosFinanceiros" "SegmentoFinanceiro"[] NOT NULL DEFAULT ARRAY[]::"SegmentoFinanceiro"[],
  "protegido"            BOOLEAN NOT NULL DEFAULT false,
  "ordem"                INTEGER NOT NULL DEFAULT 0,
  "criadoEm"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Cargo_ordem_idx" ON "Cargo" ("ordem");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cargoId" TEXT;
ALTER TABLE "User"
  ADD CONSTRAINT "User_cargoId_fkey"
  FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Cargos iniciais ─────────────────────────────────────────────────────────
-- Dono é `protegido`: tem tudo por definição e o código nem consulta a lista
-- dele. Existe para que um clique errado numa permissão não deixe o painel sem
-- ninguém capaz de gerenciar a equipe.
INSERT INTO "Cargo" ("id", "nome", "descricao", "permissoes", "segmentosFinanceiros", "protegido", "ordem", "atualizadoEm")
VALUES
  ('cargo-dono', 'Dono',
   'Acesso total, sem limite e sem divisória de caixa.',
   ARRAY['catalogo.ver','catalogo.editar','catalogo.excluir','pedidos.ver','pedidos.editar','pedidos.excluir','pedidos.status','pedidos.envio','clientes.ver','clientes.editar','clientes.excluir','financeiro.gerenciar','auditoria.ver','config.editar','equipe.gerenciar'],
   ARRAY[]::"SegmentoFinanceiro"[], true, 0, CURRENT_TIMESTAMP),

  ('cargo-admin-estufa', 'Admin da estufa',
   'Cuida dos peixes: catálogo, pedidos, clientes e o caixa da estufa. Não vê o caixa de produtos, nem mexe em configurações ou equipe.',
   ARRAY['catalogo.ver','catalogo.editar','catalogo.excluir','pedidos.ver','pedidos.editar','pedidos.status','pedidos.envio','clientes.ver','clientes.editar','clientes.excluir','financeiro.gerenciar'],
   ARRAY['PEIXES_VIVOS']::"SegmentoFinanceiro"[], false, 1, CURRENT_TIMESTAMP),

  ('cargo-admin-produtos', 'Admin de produtos',
   'Cuida da loja de aquarismo: catálogo, pedidos, clientes e o caixa de produtos. Não vê o caixa da estufa.',
   ARRAY['catalogo.ver','catalogo.editar','catalogo.excluir','pedidos.ver','pedidos.editar','pedidos.status','pedidos.envio','clientes.ver','clientes.editar','clientes.excluir','financeiro.gerenciar'],
   ARRAY['PRODUTOS']::"SegmentoFinanceiro"[], false, 2, CURRENT_TIMESTAMP),

  ('cargo-editor', 'Editor',
   'Cadastra e edita produtos, categorias, cupons e a home. Não vê pedidos, clientes nem o caixa.',
   ARRAY['catalogo.ver','catalogo.editar','catalogo.excluir'],
   ARRAY[]::"SegmentoFinanceiro"[], false, 3, CURRENT_TIMESTAMP);

-- ── Migra quem já existe ────────────────────────────────────────────────────
-- Cada membro herda o cargo equivalente ao papel que tinha, para ninguém perder
-- nem ganhar acesso na virada.
UPDATE "User" SET "cargoId" = 'cargo-dono'   WHERE "role" = 'SUPER_ADMIN';
UPDATE "User" SET "cargoId" = 'cargo-editor' WHERE "role" = 'EDITOR';
UPDATE "User"
   SET "cargoId" = CASE
         WHEN 'PRODUTOS' = ANY("segmentosFinanceiros")
              AND NOT ('PEIXES_VIVOS' = ANY("segmentosFinanceiros")) THEN 'cargo-admin-produtos'
         WHEN 'PEIXES_VIVOS' = ANY("segmentosFinanceiros")
              AND NOT ('PRODUTOS' = ANY("segmentosFinanceiros")) THEN 'cargo-admin-estufa'
         ELSE 'cargo-dono'
       END
 WHERE "role" = 'ADMIN';

-- Lucas já estava marcado como sócio só da estufa: vira Admin da estufa de fato,
-- e deixa de ser SUPER_ADMIN (que ignorava qualquer permissão).
UPDATE "User"
   SET "cargoId" = 'cargo-admin-estufa', "role" = 'ADMIN'
 WHERE "email" = 'lucas@guppydelinhagem.com.br';

-- O escopo de caixa passa a morar no cargo. A coluna do usuário sai para não
-- existirem duas fontes da verdade discordando.
ALTER TABLE "User" DROP COLUMN IF EXISTS "segmentosFinanceiros";
