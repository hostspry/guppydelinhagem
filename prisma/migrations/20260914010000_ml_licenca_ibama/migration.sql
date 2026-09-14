-- Número da licença do IBAMA da criação.
--
-- O Mercado Livre exige o número no anúncio de peixe ornamental vivo. Sem ele o
-- anúncio é cancelado, e reincidência derruba a conta. Guardar no lugar da
-- integração (e não no texto de cada produto) é o que torna impossível esquecer
-- no vigésimo cadastro: quem publica lê daqui sempre.
ALTER TABLE "IntegracaoMercadoLivre" ADD COLUMN IF NOT EXISTS "licencaIbama" TEXT;
