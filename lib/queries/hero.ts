import { prisma } from "../prisma";

export async function getActiveHeroSlides() {
  return prisma.heroSlide.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
  });
}

export async function getHeroSettings() {
  const settings = await prisma.heroSettings.findUnique({
    where: { id: "default" },
  });
  if (!settings) {
    return {
      id: "default",
      autoplayEnabled: true,
      autoplayDurationMs: 5000,
      showArrows: true,
      showDots: true,
      defaultBackgroundUrl: "/images/hero/bg-aquario-plantado.webp",
      atualizadoEm: new Date(),
    };
  }
  return settings;
}
