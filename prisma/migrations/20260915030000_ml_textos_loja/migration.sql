-- Apresentação da loja (abre) e garantia de chegada (fecha) a descrição de todo
-- anúncio de peixe no ML. Ficam na integração, como a licença do IBAMA, para
-- a IA e o "usar texto do site" nunca apagarem.
ALTER TABLE "IntegracaoMercadoLivre" ADD COLUMN "apresentacaoLoja" TEXT;
ALTER TABLE "IntegracaoMercadoLivre" ADD COLUMN "garantiaChegada" TEXT;
