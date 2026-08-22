-- CreateTable
CREATE TABLE "TemplateEmail" (
    "chave" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateEmail_pkey" PRIMARY KEY ("chave")
);
