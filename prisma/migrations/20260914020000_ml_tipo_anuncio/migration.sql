-- Tipo do anúncio (Clássico, Premium, Grátis) guardado na ligação.
--
-- A comissão muda por tipo e é o que decide a margem. Guardar aqui evita
-- consultar o ML a cada carregamento da tela só para mostrar em qual tipo cada
-- anúncio está, e é o que permite trocar de tipo pelo painel.
ALTER TABLE "MercadoLivreAnuncio" ADD COLUMN IF NOT EXISTS "tipoAnuncio" TEXT;
