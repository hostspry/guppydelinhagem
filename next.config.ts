import type { NextConfig } from "next";

// DIAGNÓSTICO build-time (temporário): mostra no LOG DE BUILD do Coolify qual
// NEXT_PUBLIC_MP_PUBLIC_KEY o `next build` recebeu — é o valor que será inlinado
// no bundle do client. Public key NÃO é segredo (vai em toda request do MP).
// Se aqui aparecer 8f705ad8, a env de BUILD do Coolify está com a key velha.
{
  const k = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  console.log(
    "[build] NEXT_PUBLIC_MP_PUBLIC_KEY =",
    k ? `${k.slice(0, 13)}… (len ${k.length})` : "UNDEFINED",
  );
}

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
