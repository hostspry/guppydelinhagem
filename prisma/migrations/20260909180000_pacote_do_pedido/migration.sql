-- Embalagem informada pelo operador.
--
-- O cálculo automático empilha as medidas dos produtos, e isso é um chute
-- conservador: ele não sabe que a criadeira desmonta e cabe num envelope. Quem
-- embala sabe. Nulo = continua usando o automático.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "pacoteAltura" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "pacoteLargura" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "pacoteComprimento" DECIMAL(8,2),
  ADD COLUMN IF NOT EXISTS "pacotePesoGramas" INTEGER;
