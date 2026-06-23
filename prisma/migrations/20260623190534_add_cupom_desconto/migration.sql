-- CreateEnum
CREATE TYPE "TipoValorCupom" AS ENUM ('PERCENTUAL', 'VALOR_FIXO');

-- CreateEnum
CREATE TYPE "EscopoCupom" AS ENUM ('TODOS', 'CATEGORIAS', 'PRODUTOS');

-- CreateEnum
CREATE TYPE "ModoAplicacaoCupom" AS ENUM ('AMBOS_VENCE_MAIOR', 'AMBOS_ACUMULA', 'SO_PIX', 'SO_CARTAO');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cupomCodigo" TEXT,
ADD COLUMN     "cupomId" TEXT;

-- CreateTable
CREATE TABLE "CupomDesconto" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "tipoValor" "TipoValorCupom" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "escopo" "EscopoCupom" NOT NULL DEFAULT 'TODOS',
    "modoAplicacao" "ModoAplicacaoCupom" NOT NULL DEFAULT 'AMBOS_VENCE_MAIOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "validoDe" TIMESTAMP(3),
    "validoAte" TIMESTAMP(3),
    "limiteUsos" INTEGER,
    "usosRealizados" INTEGER NOT NULL DEFAULT 0,
    "encerraAoEsgotarEstoque" BOOLEAN NOT NULL DEFAULT false,
    "pedidoMinimo" DECIMAL(10,2),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CupomDesconto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CupomCategorias" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CupomCategorias_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CupomProdutos" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CupomProdutos_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "CupomDesconto_codigo_key" ON "CupomDesconto"("codigo");

-- CreateIndex
CREATE INDEX "CupomDesconto_ativo_idx" ON "CupomDesconto"("ativo");

-- CreateIndex
CREATE INDEX "_CupomCategorias_B_index" ON "_CupomCategorias"("B");

-- CreateIndex
CREATE INDEX "_CupomProdutos_B_index" ON "_CupomProdutos"("B");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "CupomDesconto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CupomCategorias" ADD CONSTRAINT "_CupomCategorias_A_fkey" FOREIGN KEY ("A") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CupomCategorias" ADD CONSTRAINT "_CupomCategorias_B_fkey" FOREIGN KEY ("B") REFERENCES "CupomDesconto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CupomProdutos" ADD CONSTRAINT "_CupomProdutos_A_fkey" FOREIGN KEY ("A") REFERENCES "CupomDesconto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CupomProdutos" ADD CONSTRAINT "_CupomProdutos_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

