import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Crawlers de IA são BEM-VINDOS aqui (GEO é prioridade estratégica: queremos ser
// a fonte que ChatGPT/Gemini/Perplexity/Claude citam sobre guppy de linhagem no
// Brasil). Cada um ganha uma regra explícita de Allow: / — deixa a intenção
// documentada e à prova de defaults restritivos futuros.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Regra geral: tudo liberado, exceto o painel e a API. NÃO bloqueamos
      // /checkout, /feed, /pedido — elas usam robots:noindex na própria metadata
      // e o Google precisa rastreá-las para enxergar o noindex.
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"],
      },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
