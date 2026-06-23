import type { Metadata } from "next";

// Constantes de SEO/social reusadas em todo o site. URLs de imagem relativas
// resolvem contra o metadataBase definido no layout raiz.
export const SITE_URL = "https://www.guppydelinhagem.com.br";
export const SITE_NAME = "Guppy de Linhagem";

// Imagem OG padrão (fallback institucional) — selo da marca em WebP.
export const OG_DEFAULT = {
  url: "/images/selo.webp",
  width: 797,
  height: 760,
  alt: "Guppy de Linhagem — Marchezi Guppy Farm",
} as const;

type OgImage = { url: string; width?: number; height?: number; alt?: string; type?: string };

/**
 * Monta metadata completa de uma página indexável: title, description,
 * canonical, Open Graph e Twitter Card — com imagem própria ou o fallback
 * institucional. Fonte única para padronizar OG/Twitter no site.
 */
export function pageMeta(opts: {
  title: string;
  description: string;
  /** caminho canônico, ex.: "/" ou "/frete" */
  path: string;
  image?: OgImage;
}): Metadata {
  const img: OgImage = opts.image ?? OG_DEFAULT;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "pt_BR",
      url: opts.path,
      title: opts.title,
      description: opts.description,
      images: [img],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [img.url],
    },
  };
}
