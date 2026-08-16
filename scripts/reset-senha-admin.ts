/**
 * Reset da senha de um admin. Uso local, com o túnel SSH aberto:
 *   npx tsx scripts/reset-senha-admin.ts <email> <novaSenha>
 *
 * Sem novaSenha, gera uma aleatória e imprime no terminal.
 */
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";

const [email, senhaArg] = process.argv.slice(2);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL não definida no ambiente.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  // Sem e-mail: só lista quem pode entrar no painel.
  if (!email) {
    const admins = await prisma.user.findMany({
      where: { NOT: { role: "CUSTOMER" } },
      select: { email: true, nome: true, role: true, senhaHash: true, ultimoLogin: true },
      orderBy: { criadoEm: "asc" },
    });
    for (const u of admins) {
      console.log(
        `${u.email} | ${u.nome} | ${u.role} | senha:${u.senhaHash ? "sim" : "NAO"} | ultimoLogin:${u.ultimoLogin?.toISOString() ?? "-"}`,
      );
    }
    console.log(`\n(${admins.length} admin(s)) Para resetar: npx tsx scripts/reset-senha-admin.ts <email> [novaSenha]`);
    return;
  }

  const senha = senhaArg ?? randomBytes(9).toString("base64url");
  const senhaHash = await bcrypt.hash(senha, 10);

  const user = await prisma.user.update({
    where: { email },
    data: { senhaHash, senhaPrecisaTroca: true },
    select: { id: true, email: true, nome: true, role: true },
  });

  console.log(`OK: ${user.email} (${user.role})`);
  console.log(`Senha: ${senha}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
