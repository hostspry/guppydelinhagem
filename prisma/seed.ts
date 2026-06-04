import { PrismaPg } from "@prisma/adapter-pg";
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
  titleLine1: "Guppies Premium",
  titleLine2: "de Linhagem",
  subtitle:
    "Criação especializada com seleção genética rigorosa. Qualidade, saúde e beleza em cada detalhe.",
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

async function main() {
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
