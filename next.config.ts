import type { NextConfig } from "next";

// ── Content-Security-Policy (Report-Only nesta fase) ──────────────────────────
// Hosts de imagem/CDN derivados do remotePatterns acima (Garage/CDN do projeto:
// media/www.guppydelinhagem.com.br, utfs.io) — não chutados. MP (Brick), YouTube
// (feed), GA e ViaCEP liberados. 'unsafe-inline'/'unsafe-eval' tolerados AGORA
// (report-only) porque o Brick do MP e scripts inline do Next provavelmente
// exigem; os reports vão dizer o mínimo necessário antes do enforce.
const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://*.mercadopago.com",
    "https://*.mercadolibre.com",
    "https://sdk.mercadopago.com",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://i.ytimg.com",
    "https://*.ytimg.com",
    "https://img.youtube.com",
    "https://www.guppydelinhagem.com.br",
    "https://media.guppydelinhagem.com.br",
    "https://utfs.io",
    "https://www.google-analytics.com",
  ],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    "https://viacep.com.br",
    "https://*.mercadopago.com",
    "https://*.mercadolibre.com",
    "https://www.guppydelinhagem.com.br",
    "https://media.guppydelinhagem.com.br",
    "https://utfs.io",
    "https://www.google-analytics.com",
    "https://*.analytics.google.com",
    "https://*.google-analytics.com",
    "https://www.googletagmanager.com",
  ],
  "frame-src": [
    "'self'",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://*.mercadopago.com",
    "https://*.mercadolibre.com",
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'self'"],
};

const cspReportOnly = [
  ...Object.entries(cspDirectives).map(([k, v]) => `${k} ${v.join(" ")}`),
  "upgrade-insecure-requests",
  "report-uri /api/csp-report", // TEMP: CSP tuning
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "www.guppydelinhagem.com.br" },
      { protocol: "https", hostname: "media.guppydelinhagem.com.br" },
      { protocol: "https", hostname: "utfs.io" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  // A vitrine virou a home: /loja (listagem) redireciona permanente para "/".
  // A query é preservada (?categoria=...&busca=...), então links antigos e os
  // cards de categoria continuam filtrando a grade. /loja/[slug] (produto) é
  // outra rota e não é afetada.
  async redirects() {
    return [
      {
        source: "/loja",
        destination: "/",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // CSP em REPORT-ONLY: observa violações sem bloquear nada (não quebra
          // o checkout/Brick). Próximo passo: trocar p/ Content-Security-Policy
          // (enforce) após dias de reports limpos.
          {
            key: "Content-Security-Policy-Report-Only",
            value: cspReportOnly,
          },
          // HSTS — HABILITAR após confirmar HTTPS forçado no proxy (Traefik/Let's
          // Encrypt) para TODAS as rotas, inclusive /admin. Antes disso pode
          // travar o acesso. Pendente de confirmação de infra.
          // {
          //   key: "Strict-Transport-Security",
          //   value: "max-age=63072000; includeSubDomains; preload",
          // },
        ],
      },
    ];
  },
};

export default nextConfig;
