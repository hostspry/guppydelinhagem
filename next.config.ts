import type { NextConfig } from "next";

// ── Content-Security-Policy (ENFORCE) ─────────────────────────────────────────
// Allowlist fechada com base nos reports de produção (Report-Only). Hosts de
// imagem/CDN derivados do remotePatterns (Garage/CDN do projeto:
// media/www.guppydelinhagem.com.br, utfs.io). MP/Brick (inclui http2.mlstatic.com
// e os apex .com.br/.com dos pixels antifraude), YouTube (feed), GA e ViaCEP
// liberados. 'unsafe-inline'/'unsafe-eval' MANTIDOS por ora (o Brick provavelmente
// depende); endurecer fica para uma rodada futura, depois do enforce estável.
const cspDirectives: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://*.mercadopago.com",
    "https://*.mercadolibre.com",
    "https://sdk.mercadopago.com",
    "https://http2.mlstatic.com", // CDN de assets do Card Brick (cardPayment.js)
    // PagBank: SDK Connect JS (criptografia de cartão + 3DS) e o desafio 3DS
    // (Cardinal/ACS). Sem estes, o cartão/3DS do PagBank é bloqueado.
    "https://assets.pagseguro.com.br",
    "https://*.cardinalcommerce.com",
    "https://*.cardinaltrusted.com",
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
    "https://http2.mlstatic.com", // SVGs de bandeira do Brick
    "https://www.mercadopago.com.br", // pixels de fingerprint antifraude (TLD .com.br)
    "https://www.mercadolibre.com", // idem (apex, fora do *.mercadolibre.com)
    "https://*.pagseguro.com", // PNG do QR do Pix PagBank (api.pagseguro.com)
    "https://www.google-analytics.com",
  ],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    "https://viacep.com.br",
    "https://*.mercadopago.com",
    "https://*.mercadolibre.com",
    "https://http2.mlstatic.com", // configs/i18n/SVGs do Brick via fetch
    // PagBank: sessão 3DS + API (sdk/api.pagseguro.com), SDK e desafio 3DS.
    "https://*.pagseguro.com",
    "https://assets.pagseguro.com.br",
    "https://*.cardinalcommerce.com",
    "https://*.cardinaltrusted.com",
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
    // PagBank: desafio 3DS (iframe Cardinal/ACS). Domínios do emissor podem
    // aparecer dinamicamente no desafio; os wildcards Cardinal cobrem o SDK.
    "https://*.cardinalcommerce.com",
    "https://*.cardinaltrusted.com",
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'self'"],
};

const cspValue = [
  ...Object.entries(cspDirectives).map(([k, v]) => `${k} ${v.join(" ")}`),
  "upgrade-insecure-requests",
  "report-uri /api/csp-report", // TEMP: mantido por 1 ciclo p/ pegar bordas no enforce
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
    // Reduz o pico de memória do build (webpack) — ajuda a evitar OOM no
    // "Collecting build traces" no VPS, que roda app+banco+storage juntos.
    webpackMemoryOptimizations: true,
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
          // CSP em ENFORCE: allowlist fechada com base nos reports de produção
          // (MP/mlstatic incluídos). report-uri mantido por 1 ciclo para pegar
          // qualquer borda que só apareça bloqueando de fato.
          {
            key: "Content-Security-Policy",
            value: cspValue,
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
