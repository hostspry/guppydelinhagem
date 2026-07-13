-- Selo de linhagem campeã mundial (World Guppy Contest) por produto.
ALTER TABLE "Product" ADD COLUMN "linhagemCampea" BOOLEAN NOT NULL DEFAULT false;
