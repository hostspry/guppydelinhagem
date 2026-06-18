-- AlterEnum
ALTER TYPE "StatusPagamento" ADD VALUE 'EM_ANALISE';

-- AlterTable
ALTER TABLE "Pagamento" ADD COLUMN     "bandeira" TEXT,
ADD COLUMN     "parcelas" INTEGER;
