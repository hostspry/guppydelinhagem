-- AlterEnum
BEGIN;
CREATE TYPE "ProductType_new" AS ENUM ('PEIXE', 'CORAL', 'PLANTA', 'ALIMENTO_VIVO', 'RACAO', 'ACESSORIO', 'DIGITAL');
ALTER TABLE "public"."Product" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "Product" ALTER COLUMN "tipo" TYPE "ProductType_new" USING ("tipo"::text::"ProductType_new");
ALTER TYPE "ProductType" RENAME TO "ProductType_old";
ALTER TYPE "ProductType_new" RENAME TO "ProductType";
DROP TYPE "public"."ProductType_old";
ALTER TABLE "Product" ALTER COLUMN "tipo" SET DEFAULT 'PEIXE';
COMMIT;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "sexoComposicao",
ALTER COLUMN "tipo" SET DEFAULT 'PEIXE';

-- Limpeza de dados: categorias antigas (agora sem produtos) — não geradas pelo migrate diff
DELETE FROM "Category" WHERE "slug" IN ('trios-guppys', 'pet-premium', 'machos');
