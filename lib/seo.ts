import type { Metadata } from "next";

// Constantes de SEO/social reusadas em todo o site. URLs de imagem relativas
// resolvem contra o metadataBase definido no layout raiz.
export const SITE_URL = "https://www.guppydelinhagem.com.br";
export const SITE_NAME = "Guppy de Linhagem";

// Cartão de compartilhamento (WhatsApp, Facebook, X). Três exigências que o
// selo quadrado em WebP não atendia: 1200x630 (senão vira miniatura pequena em
// vez do banner), JPEG (WebP é o formato que o WhatsApp menos suporta em prévia)
// e a arte do hero, que é a cara do site. Gerado de public/images/hero +
// public/logo.png; para refazer, veja docs/og-cartao-compartilhamento.md.
// O ?v= existe porque WhatsApp e Facebook guardam a prévia pela URL da imagem.
// Trocou a arte? Suba o número, senão quem já compartilhou continua vendo a
// versão velha por dias.
export const OG_DEFAULT = {
  url: "/images/og-home.jpg?v=3",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Guppys de linhagem da Marchezi Guppy Farm em aquário plantado",
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
