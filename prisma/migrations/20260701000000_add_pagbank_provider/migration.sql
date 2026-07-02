-- AlterEnum
ALTER TYPE "ProviderPagamento" ADD VALUE 'PAGBANK';

-- AlterTable
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN     "pagbankAtivo" BOOLEAN NOT NULL DEFAULT false;
