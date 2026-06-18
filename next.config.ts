import type { NextConfig } from "next";

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
};

export default nextConfig;
