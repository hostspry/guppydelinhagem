import { getActiveHeroSlides, getHeroSettings } from "@/lib/queries/hero";
import { HeroStatic } from "./HeroStatic";
import { HeroSlider } from "./HeroSlider";

export async function HeroSection() {
  const [slides, settings] = await Promise.all([
    getActiveHeroSlides(),
    getHeroSettings(),
  ]);

  if (slides.length === 0) return null;
  if (slides.length === 1) {
    return <HeroStatic slide={slides[0]} settings={settings} />;
  }
  return <HeroSlider slides={slides} settings={settings} />;
}
