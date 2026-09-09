"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Deep link: ao abrir /loja/<slug> no MOBILE, abre o feed tela cheia naquele
// produto (?p=<slug>). No desktop não faz nada (feed é só mobile).
//
// Anti-loop: marca a sessão (sessionStorage) ao auto-abrir. Quando o usuário
// fecha o feed (X → router.back() → volta pra /loja/<slug>), a flag já está
// setada e a página NÃO reabre o feed — ele vê a página do produto normalmente.
// Pode reabrir o feed tocando no vídeo (handlePlay da página de produto).
export default function FeedAutoOpen({
  slug,
  temVideo,
}: {
  slug: string;
  /**
   * Sem vídeo não há feed: o produto nem entra na lista (o feed só traz quem
   * tem vídeo ativo). Abrir mesmo assim jogaria o cliente num feed de OUTROS
   * produtos, longe do que ele quis ver — foi o que aconteceu com a primeira
   * criadeira cadastrada.
   */
  temVideo: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!temVideo) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return; // só mobile

    const key = `feed-auto:${slug}`;
    if (sessionStorage.getItem(key)) return; // já abriu nesta sessão → não repete
    sessionStorage.setItem(key, "1");
    router.push(`/feed?p=${encodeURIComponent(slug)}`);
  }, [slug, router, temVideo]);

  return null;
}
