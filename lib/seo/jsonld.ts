// Builders puros de JSON-LD (schema.org). Sem I/O e sem React — recebem dados já
// resolvidos e devolvem objetos serializáveis. Renderização fica no <JsonLd/>
// (components/seo/JsonLd), que faz o escape anti-XSS.
//
// Consistência de entidade (crítica para GEO): a MESMA organização aparece na
// home (como OnlineStore) e em /sobre-nos (como Organization dentro de AboutPage),
// com o MESMO @id, name, sameAs e award. Fonte dos dados: lib/sobre-content.

import { ORG, REDES, conquistas } from "@/lib/sobre-content";

// @id canônico da organização — âncora que o Google usa para unificar a entidade
// entre as páginas. Sempre relativo ao host canônico (com www).
export function orgId(siteUrl: string): string {
  return `${siteUrl}/#organization`;
}

// Prêmios no MESMO formato usado nos cards de /sobre-nos (fonte: conquistas).
function awards(): string[] {
  return conquistas.map((c) => `${c.linha} — ${c.titulo} (${c.anos}), ${c.evento}`);
}

/**
 * Entidade-organização base (sem @context nem @type — quem chama define). Reúne
 * os dados confirmados (ORG + REDES + conquistas). Inclui contactPoint só quando
 * o WhatsApp E.164 é informado.
 */
export function orgEntity(
  siteUrl: string,
  opts: { whatsappE164?: string } = {},
): Record<string, unknown> {
  return {
    "@id": orgId(siteUrl),
    name: ORG.nome,
    alternateName: "Guppy de Linhagem",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    founder: { "@type": "Person", name: ORG.fundador },
    foundingDate: ORG.fundacao,
    areaServed: ORG.pais,
    location: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: ORG.cidade,
        addressRegion: ORG.uf,
        addressCountry: ORG.pais,
      },
    },
    ...(opts.whatsappE164
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            telephone: opts.whatsappE164,
            contactType: "customer service",
            availableLanguage: "Portuguese",
          },
        }
      : {}),
    award: awards(),
    sameAs: [REDES.youtube, REDES.instagram],
  };
}

/**
 * OnlineStore para a home — a MESMA entidade (mesmo @id) apresentada como loja.
 * OnlineStore é subtipo de Organization; o Google unifica pelo @id.
 */
export function onlineStoreJsonLd(
  siteUrl: string,
  opts: { whatsappE164?: string } = {},
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    ...orgEntity(siteUrl, opts),
    description:
      "Criação e venda de guppys (lebistes) de linhagem pedigree do criador tricampeão mundial (World Guppy Contest). Envio de peixes vivos para todo o Brasil a partir de Guarapari/ES.",
  };
}

/**
 * AboutPage de /sobre-nos, com a organização como mainEntity — mesmo @id da home.
 */
export function aboutPageJsonLd(
  siteUrl: string,
  opts: { whatsappE164?: string } = {},
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Sobre a Marchezi Guppy Farm",
    mainEntity: {
      "@type": "Organization",
      ...orgEntity(siteUrl, opts),
      description:
        "Criação familiar de guppys (lebistes) de linhagem em Guarapari, Espírito Santo, desde 2000. Criação pela beleza, com linhas premiadas em campeonatos mundiais.",
    },
  };
}

// ── BreadcrumbList ────────────────────────────────────────────────────────────
export type CrumbItem = { name: string; url?: string };

export function breadcrumbJsonLd(items: CrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      // Item só no que tem URL (o último — a própria página — costuma vir sem).
      ...(it.url ? { item: it.url } : {}),
    })),
  };
}

// ── FAQPage ───────────────────────────────────────────────────────────────────
export type QaPair = { pergunta: string; resposta: string };

export function faqPageJsonLd(pares: readonly QaPair[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pares.map((qa) => ({
      "@type": "Question",
      name: qa.pergunta,
      acceptedAnswer: { "@type": "Answer", text: qa.resposta },
    })),
  };
}

// ── CollectionPage (páginas de catálogo: /linhagens, /linhagens/endler) ───────
/**
 * CollectionPage de uma página de catálogo/listagem. Amarra a página à MESMA
 * entidade-organização (mesmo @id) via isPartOf/about, reforçando para o Google
 * que a coleção é da Marchezi Guppy Farm. Sem inventar itens: descreve a coleção,
 * não lista produtos (o grid já é HTML rastreável).
 */
export function collectionPageJsonLd(
  siteUrl: string,
  opts: { name: string; description: string; path: string },
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: `${siteUrl}${opts.path}`,
    isPartOf: { "@id": orgId(siteUrl) },
    about: { "@id": orgId(siteUrl) },
  };
}

// ── Article (guias de conteúdo: /guia/*) ──────────────────────────────────────
/**
 * Article de uma página de guia. Autor e publisher apontam para a MESMA
 * organização (mesmo @id da home/sobre) — reforça autoria/E-E-A-T para GEO.
 */
export function articleJsonLd(
  siteUrl: string,
  opts: { headline: string; description: string; path: string; image?: string },
): Record<string, unknown> {
  const url = `${siteUrl}${opts.path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    ...(opts.image ? { image: [opts.image] } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    author: { "@id": orgId(siteUrl) },
    publisher: { "@id": orgId(siteUrl) },
    inLanguage: "pt-BR",
  };
}

// ── Product + Offer/AggregateOffer ────────────────────────────────────────────
const IN_STOCK = "https://schema.org/InStock";
const OUT_OF_STOCK = "https://schema.org/OutOfStock";
const SELLER = { "@type": "Organization", name: ORG.nome };

// 2 casas, string — formato exigido pelo rich result de Product.
function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export type ProductJsonLdInput = {
  name: string;
  description?: string;
  image: string; // URL absoluta
  sku: string;
  url: string; // URL absoluta da página
  inStock: boolean;
  /** Preços efetivos de venda (o mesmo número em destaque na página), por variante. */
  precos: number[];
};

export function productJsonLd(p: ProductJsonLdInput): Record<string, unknown> {
  const availability = p.inStock ? IN_STOCK : OUT_OF_STOCK;
  const precos = p.precos.length > 0 ? p.precos : [0];
  const low = Math.min(...precos);
  const high = Math.max(...precos);

  // Preço único (uma variante ou todas iguais) → Offer; senão → AggregateOffer.
  const offers =
    low === high
      ? {
          "@type": "Offer",
          price: money(low),
          priceCurrency: "BRL",
          availability,
          url: p.url,
          seller: SELLER,
        }
      : {
          "@type": "AggregateOffer",
          lowPrice: money(low),
          highPrice: money(high),
          offerCount: precos.length,
          priceCurrency: "BRL",
          availability,
          url: p.url,
          seller: SELLER,
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    image: [p.image],
    sku: p.sku,
    brand: { "@type": "Brand", name: ORG.nome },
    url: p.url,
    offers,
  };
}
