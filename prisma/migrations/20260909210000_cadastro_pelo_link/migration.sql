-- Cadastro que o próprio cliente preencheu, pelo link público /cadastro.
--
-- Venda fechada no WhatsApp: em vez de ditar rua, número e CEP na conversa (e
-- a gente digitar errado), o cliente recebe o link e preenche. A data marca de
-- onde veio o cadastro e ordena a lista de "chegaram agora" na tela de venda.
ALTER TABLE "Cliente"
  ADD COLUMN IF NOT EXISTS "cadastroProprioEm" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Cliente_cadastroProprioEm_idx"
  ON "Cliente" ("cadastroProprioEm");
