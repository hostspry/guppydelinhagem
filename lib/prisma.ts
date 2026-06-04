import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// Singleton com inicialização preguiçosa.
//
// - Lazy: só instancia o client quando alguém de fato acessa `prisma.algumModelo`.
//   Isso evita que `import { prisma }` durante o "Collecting page data" do
//   build do Next (sem DATABASE_URL no builder stage do Docker) quebre tudo.
// - Singleton via globalThis: em dev/hot-reload o módulo é reavaliado várias
//   vezes; cachear no global evita esgotar o pool de conexões.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let cached: PrismaClient | undefined;

function getInstance(): PrismaClient {
  if (cached) return cached;
  if (globalForPrisma.prisma) {
    cached = globalForPrisma.prisma;
    return cached;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não encontrada no ambiente.");
  }
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  cached = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = cached;
  }
  return cached;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver);
  },
});
