-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
