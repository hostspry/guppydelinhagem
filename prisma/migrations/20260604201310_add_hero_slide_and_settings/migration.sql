-- CreateTable
CREATE TABLE "HeroSlide" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "eyebrowText" TEXT,
    "eyebrowIcon" TEXT,
    "titleLine1" TEXT NOT NULL,
    "titleLine2" TEXT,
    "subtitle" TEXT,
    "fishImageUrl" TEXT NOT NULL,
    "fishImageAlt" TEXT NOT NULL,
    "backgroundUrl" TEXT,
    "badgeText" TEXT,
    "badgeYear" TEXT,
    "badgeIcon" TEXT,
    "primaryCtaText" TEXT NOT NULL DEFAULT 'Comprar agora',
    "primaryCtaUrl" TEXT NOT NULL DEFAULT '/loja',
    "secondaryCtaText" TEXT,
    "secondaryCtaUrl" TEXT,
    "productId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeroSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "autoplayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "autoplayDurationMs" INTEGER NOT NULL DEFAULT 5000,
    "showArrows" BOOLEAN NOT NULL DEFAULT true,
    "showDots" BOOLEAN NOT NULL DEFAULT true,
    "defaultBackgroundUrl" TEXT NOT NULL DEFAULT '/images/hero/bg-aquario-plantado.webp',
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeroSlide_active_order_idx" ON "HeroSlide"("active", "order");
