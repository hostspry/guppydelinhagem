import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { getActiveProductsForSitemap } from "@/lib/queries/products";

// Sitemap dinâmico (convenção do App Router). Cacheado por 1h — o banco só é
// consultado quando o cache expira (o catálogo muda devagar; produto novo entra
// no máximo em 1h). O host é sempre o canônico COM www (lib/seo.SITE_URL).
export const revalidate = 3600;

// Rotas públicas e indexáveis. NÃO inclui /checkout, /carrinho, /feed, /pedido,
// /login, /cadastro, /minha-conta, /admin (privadas ou noindex).
const ESTATICAS: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
  { url: `${SITE_URL}/linhagens`, changeFrequency: "weekly", priority: 0.9 },
  { url: `${SITE_URL}/linhagens/endler`, changeFrequency: "weekly", priority: 0.8 },
  // /atacado escondido por ora (decisão do negócio) — fora do sitemap e noindex.
  { url: `${SITE_URL}/envio`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/peixe-guppy`, changeFrequency: "monthly", priority: 0.9 },
  { url: `${SITE_URL}/sobre-nos`, changeFrequency: "monthly", priority: 0.8 },
  { url: `${SITE_URL}/guia/como-cuidar-de-guppy`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/guia/reproducao-de-guppy`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/guia/macho-e-femea`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/guia/filhotes-de-guppy`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/frete`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/contatos`, changeFrequency: "monthly", priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Se o banco estiver indisponível no momento da geração (ex.: build sem túnel),
  // ainda entregamos as rotas estáticas em vez de quebrar o /sitemap.xml.
  let produtos: { slug: string; atualizadoEm: Date }[] = [];
  try {
    produtos = await getActiveProductsForSitemap();
  } catch (err) {
    console.error("[sitemap] falha ao listar produtos, servindo só estáticas:", err);
  }

  const produtosUrls: MetadataRoute.Sitemap = produtos.map((p) => ({
    url: `${SITE_URL}/loja/${p.slug}`,
    lastModified: p.atualizadoEm,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  return [...ESTATICAS, ...produtosUrls];
}
