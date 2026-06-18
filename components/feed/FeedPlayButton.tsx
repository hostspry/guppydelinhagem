"use client";

import { useRouter } from "next/navigation";
import { Play } from "lucide-react";

// Overlay de "play" só no mobile (<lg): tocar no vídeo do card abre o feed tela
// cheia começando neste produto. No desktop fica oculto (lg:hidden) — card segue
// navegando pro produto como sempre. preventDefault/stopPropagation evita que o
// <Link> do card navegue ao tocar no play.
export default function FeedPlayButton({ slug }: { slug: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/feed?p=${encodeURIComponent(slug)}`);
      }}
      aria-label="Assistir no feed"
      className="lg:hidden absolute inset-0 z-10 flex items-center justify-center"
    >
      <span className="bg-black/45 rounded-full p-3">
        <Play className="w-6 h-6 text-white fill-white" aria-hidden="true" />
      </span>
    </button>
  );
}
