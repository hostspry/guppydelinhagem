"use client";

import Image from "next/image";
import Link from "next/link";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import type {
  HeroSlide,
  HeroSettings,
} from "@/lib/generated/prisma/client";

type Props = {
  slide: HeroSlide;
  settings: HeroSettings;
};

// Resolve nome de ícone string ("Trophy", "Award") pro componente Lucide
function getIcon(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon>)[name];
  return Icon ?? null;
}

const FEATURES = [
  {
    icon: "Trophy",
    title: "Linhagens Premiadas",
    subtitle: "Reconhecidas em concursos",
  },
  {
    icon: "Truck",
    title: "Envio para todo o Brasil",
    subtitle: "Embalagem segura e térmica",
  },
  {
    icon: "Heart",
    title: "Criação Responsável",
    subtitle: "Saúde e bem-estar sempre",
  },
  {
    icon: "Users",
    title: "Clientes em todo Brasil",
    subtitle: "Satisfação e confiança",
  },
] as const;

export function HeroStatic({ slide, settings }: Props) {
  const EyebrowIcon = getIcon(slide.eyebrowIcon);
  const BadgeIcon = getIcon(slide.badgeIcon);
  const backgroundUrl = slide.backgroundUrl ?? settings.defaultBackgroundUrl;

  // Detecta CTAs WhatsApp pra renderizar o ícone oficial verde;
  // não-WhatsApp usa ícone genérico do Lucide.
  const isPrimaryWhatsapp = slide.primaryCtaUrl.includes("wa.me");
  const isSecondaryWhatsapp = !!slide.secondaryCtaUrl?.includes("wa.me");
  const PrimaryFallbackIcon = LucideIcons.ShoppingCart;
  const SecondaryFallbackIcon = LucideIcons.ArrowRight;

  return (
    <section className="relative w-full overflow-hidden bg-[#051F3E] min-h-[520px] md:min-h-[600px] flex flex-col isolate">
      {/* Background — z-index 0 no isolation context do section */}
      <Image
        src={backgroundUrl}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center z-0"
        aria-hidden="true"
      />

      {/* Overlay gradient pra contraste do texto */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(7,54,106,0.88) 0%, rgba(7,54,106,0.55) 55%, rgba(7,54,106,0.15) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Overlay extra só mobile: terço inferior navy quase sólido pra texto se destacar */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 md:hidden z-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(5,31,62,0.95) 0%, rgba(5,31,62,0.75) 50%, rgba(5,31,62,0) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Conteúdo principal */}
      <div className="container-site relative z-10 flex-1 py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-12 items-center">
          {/* Coluna texto */}
          <div className="space-y-4 md:space-y-6 order-2 md:order-1">
            {slide.eyebrowText && (
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-pill border border-white/20 bg-white/5 backdrop-blur-sm">
                {EyebrowIcon && (
                  <EyebrowIcon size={14} className="text-accent" aria-hidden="true" />
                )}
                <span className="text-xs font-bold text-accent uppercase tracking-[0.15em]">
                  {slide.eyebrowText}
                </span>
              </span>
            )}

            <h1 className="font-bold leading-[0.95] tracking-tight">
              <span className="block text-[40px] md:text-[60px] text-white">
                {slide.titleLine1}
              </span>
              {slide.titleLine2 && (
                <span className="block text-[40px] md:text-[60px] text-secondary">
                  {slide.titleLine2}
                </span>
              )}
            </h1>

            {slide.subtitle && (
              <p className="text-base md:text-lg text-white/95 md:text-[#cccccc] leading-relaxed max-w-[500px]">
                {slide.subtitle}
              </p>
            )}

            <div className="h-[2px] w-[60px] bg-secondary" aria-hidden="true" />

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href={slide.primaryCtaUrl}
                className="inline-flex items-center justify-center gap-2 w-full md:w-auto min-h-12 bg-secondary text-white hover:text-white font-semibold px-7 py-3.5 rounded-pill shadow-[0_8px_24px_-8px_rgba(255,3,92,0.6)] hover:brightness-110 transition-all"
              >
                {isPrimaryWhatsapp ? (
                  <WhatsAppIcon className="w-[18px] h-[18px]" />
                ) : (
                  <PrimaryFallbackIcon size={18} aria-hidden="true" />
                )}
                {slide.primaryCtaText}
              </Link>

              {slide.secondaryCtaText && slide.secondaryCtaUrl && (
                <a
                  href={slide.secondaryCtaUrl}
                  target={
                    slide.secondaryCtaUrl.startsWith("http") ? "_blank" : undefined
                  }
                  rel={
                    slide.secondaryCtaUrl.startsWith("http")
                      ? "noopener noreferrer"
                      : undefined
                  }
                  className="inline-flex items-center justify-center gap-2 w-full md:w-auto min-h-12 bg-transparent border-2 border-white text-white font-semibold px-6 py-3 rounded-pill hover:bg-white hover:text-primary transition-all"
                >
                  {isSecondaryWhatsapp ? (
                    <WhatsAppIcon className="w-[18px] h-[18px] text-[#25D366]" />
                  ) : (
                    <SecondaryFallbackIcon size={18} aria-hidden="true" />
                  )}
                  {slide.secondaryCtaText}
                </a>
              )}
            </div>
          </div>

          {/* Coluna peixe */}
          <div className="order-1 md:order-2 relative min-h-[260px] md:min-h-[420px]">
            <div className="relative w-full h-[260px] md:h-[480px]">
              <Image
                src={slide.fishImageUrl}
                alt={slide.fishImageAlt}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain object-center md:object-right"
              />
            </div>

            {/* Selo Linhagem Campeã */}
            {slide.badgeText && (
              <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 bg-white rounded-xl shadow-xl px-4 py-2.5 flex items-center gap-3 border border-accent/30">
                {BadgeIcon && (
                  <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <BadgeIcon size={18} className="text-white" aria-hidden="true" />
                  </div>
                )}
                <div className="flex flex-col leading-tight">
                  <span className="text-[10px] uppercase tracking-wider text-accent font-bold">
                    Linhagem Campeã
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {slide.badgeText}
                    {slide.badgeYear && ` · ${slide.badgeYear}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Faixa de features no rodapé */}
      <div className="relative z-10 bg-black/55 backdrop-blur-sm border-t border-white/10">
        <div className="container-site py-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {FEATURES.map((f) => {
              const Icon = getIcon(f.icon);
              return (
                <div key={f.title} className="flex items-center gap-3">
                  {Icon && (
                    <Icon
                      size={26}
                      className="text-accent shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm font-bold text-white">
                      {f.title}
                    </span>
                    <span className="text-xs text-white/70">{f.subtitle}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
