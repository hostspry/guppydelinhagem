-- Conta criada pelo formulário /cadastro do site (e-mail não confirmado).
-- Só acrescenta uma coluna opcional: a versão no ar continua funcionando.
ALTER TABLE "User" ADD COLUMN "cadastroSiteEm" TIMESTAMP(3);
