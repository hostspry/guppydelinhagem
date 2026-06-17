-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "estoqueBaixado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "composicao" "TipoComposicao",
ADD COLUMN     "qtdFemeas" INTEGER,
ADD COLUMN     "qtdMachos" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "estoqueFemeas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estoqueMachos" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "qtdFemeas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "qtdMachos" INTEGER NOT NULL DEFAULT 0;
