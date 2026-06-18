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
export default function FeedAutoOpen({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return; // só mobile

    const key = `feed-auto:${slug}`;
    if (sessionStorage.getItem(key)) return; // já abriu nesta sessão → não repete
    sessionStorage.setItem(key, "1");
    router.push(`/feed?p=${encodeURIComponent(slug)}`);
  }, [slug, router]);

  return null;
}
