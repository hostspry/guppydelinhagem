import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { WHATSAPP_URL } from "../lib/constants";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL não encontrada no ambiente. Verifique se .env está carregado.",
  );
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BLUE_DRAGON_ID = "hero-blue-dragon-2024";

const blueDragonData = {
  active: true,
  order: 0,
  eyebrowText: "LINHAGENS PREMIADAS",
  eyebrowIcon: "Trophy",
  titleLine1: "Guppies",
  titleLine2: "de Linhagem",
  subtitle:
    "Guppys criados com cuidado, da escolha das matrizes ao dia do envio. Saúde e beleza em cada peixe.",
  fishImageUrl: "/images/hero/blue-dragon-hero.webp",
  fishImageAlt:
    "Blue Dragon Halfmoon Snakeskin — campeão World Guppy Contest 2024",
  backgroundUrl: null,
  badgeText: null,
  badgeYear: null,
  badgeIcon: null,
  primaryCtaText: "Comprar agora",
  primaryCtaUrl: "/loja",
  secondaryCtaText: "Falar no WhatsApp",
  secondaryCtaUrl: WHATSAPP_URL,
  productId: null,
};

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD precisam estar no .env pra seedar o admin inicial.",
    );
  }
  const senhaHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      nome: "Manassés",
      senhaHash,
      role: "SUPER_ADMIN",
      senhaPrecisaTroca: true,
    },
    update: {
      // upsert idempotente — mantém role/nome existentes; só reseta senha
      // se a senha do .env mudar (útil pra ambientes de dev).
      senhaHash,
      senhaPrecisaTroca: true,
    },
    select: { id: true, email: true, role: true },
  });
  console.log(`[seed] Admin upserted: ${user.email} (${user.role})`);
}

// Categorias finais (nível de linhagem). Idempotente.
async function seedCategorias() {
  const cats = [
    { slug: "linhagens-exclusivas", nome: "Linhagens Exclusivas", ordem: 0 },
    { slug: "sem-linhagem", nome: "Sem Linhagem", ordem: 1 },
  ];
  for (const c of cats) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: { nome: c.nome, ordem: c.ordem },
    });
  }
  console.log(`[seed] Categorias upserted: ${cats.map((c) => c.slug).join(", ")}`);
}

async function main() {
  await seedAdmin();
  await seedCategorias();

  const slide = await prisma.heroSlide.upsert({
    where: { id: BLUE_DRAGON_ID },
    create: { id: BLUE_DRAGON_ID, ...blueDragonData },
    update: blueDragonData,
  });
  console.log(`[seed] HeroSlide upserted: ${slide.id}`);

  const settings = await prisma.heroSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      defaultBackgroundUrl: "/images/hero/bg-aquario-plantado.webp",
    },
    update: {
      defaultBackgroundUrl: "/images/hero/bg-aquario-plantado.webp",
    },
  });
  console.log(`[seed] HeroSettings upserted: ${settings.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
