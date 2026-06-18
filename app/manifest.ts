import type { MetadataRoute } from "next";

// Web App Manifest (Android / "adicionar à tela inicial" / PWA). O Next gera
// /manifest.webmanifest e injeta <link rel="manifest"> automaticamente.
// Os ícones 192/512 + o maskable (recorte seguro do Android) vêm de /images.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Guppy de Linhagem",
    short_name: "Guppy",
    description:
      "Guppys de linhagem selecionados, saudáveis e com genética apurada. Campeões mundiais World Guppy Contest.",
    lang: "pt-BR",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#07366A", // navy da marca
    icons: [
      {
        src: "/images/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/images/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
