-- Produto seco (ração, criadeira, filtro…) não vai em caixa de isopor e não
-- precisa de Jadlog. Passa a cotar todo o catálogo do Melhor Envio e a pagar a
-- cotação + uma taxa fixa de embalagem, no lugar do markup + R$ 20 do peixe.
ALTER TABLE "ConfiguracaoLoja"
  ADD COLUMN IF NOT EXISTS "taxaEmbalagemSeco" DECIMAL(10,2) NOT NULL DEFAULT 5;

-- Serviço do Melhor Envio escolhido no checkout. O enum Transportadora tem 3
-- valores e não acompanha o catálogo do ME, então guardamos id e nome reais.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "servicoEnvioId" INTEGER,
  ADD COLUMN IF NOT EXISTS "servicoEnvioNome" TEXT;
