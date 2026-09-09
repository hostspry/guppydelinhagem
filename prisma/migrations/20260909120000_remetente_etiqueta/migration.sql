-- Dados do remetente da etiqueta.
--
-- O Melhor Envio recusa a compra sem rua, número, bairro, documento e telefone
-- de quem envia. O sistema só tinha CEP, cidade e UF da loja, e o "logradouro"
-- guardado era o nome da fazenda, não um endereço postal. Sem isto, nenhuma
-- etiqueta poderia ser comprada.
ALTER TABLE "ConfiguracaoLoja"
  ADD COLUMN IF NOT EXISTS "remetenteNome" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteDocumento" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteTelefone" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteCep" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteLogradouro" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteNumero" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteComplemento" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteBairro" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteCidade" TEXT,
  ADD COLUMN IF NOT EXISTS "remetenteUf" VARCHAR(2);

-- Só o que já era conhecido e confiável (bate com FRETE_CONFIG.cepOrigem). Rua,
-- número, bairro, documento e telefone ficam em branco de propósito: o dono
-- preenche no admin, e a compra da etiqueta recusa até lá.
UPDATE "ConfiguracaoLoja"
   SET "remetenteCep" = COALESCE("remetenteCep", '29201010'),
       "remetenteCidade" = COALESCE("remetenteCidade", 'Guarapari'),
       "remetenteUf" = COALESCE("remetenteUf", 'ES')
 WHERE id = 'default';
