"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type {
  HeroSlide,
  HeroSettings,
} from "@/lib/generated/prisma/client";
import { HeroStatic } from "./HeroStatic";

type Props = {
  slides: HeroSlide[];
  settings: HeroSettings;
};

export function HeroSlider({ slides, settings }: Props) {
  const plugins = settings.autoplayEnabled
    ? [
        Autoplay({
          delay: settings.autoplayDurationMs,
          stopOnInteraction: false,
          stopOnMouseEnter: true,
        }),
      ]
    : [];

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, plugins);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (i: number) => emblaApi?.scrollTo(i),
    [emblaApi],
  );

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {slides.map((slide) => (
            <div className="min-w-0 flex-[0_0_100%]" key={slide.id}>
              <HeroStatic slide={slide} settings={settings} />
            </div>
          ))}
        </div>
      </div>

      {settings.showArrows && slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={scrollPrev}
            aria-label="Slide anterior"
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            aria-label="Próximo slide"
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </>
      )}

      {settings.showDots && slides.length > 1 && (
        <div className="absolute bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Ir para slide ${i + 1}`}
              aria-current={i === selectedIndex}
              className={`h-2 rounded-full transition-all ${
                i === selectedIndex
                  ? "w-8 bg-secondary"
                  : "w-2 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
