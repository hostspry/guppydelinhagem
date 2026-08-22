-- CreateTable
CREATE TABLE "TokenSenha" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenSenha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenSenha_tokenHash_key" ON "TokenSenha"("tokenHash");

-- CreateIndex
CREATE INDEX "TokenSenha_userId_idx" ON "TokenSenha"("userId");

-- CreateIndex
CREATE INDEX "TokenSenha_expiraEm_idx" ON "TokenSenha"("expiraEm");

-- AddForeignKey
ALTER TABLE "TokenSenha" ADD CONSTRAINT "TokenSenha_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
