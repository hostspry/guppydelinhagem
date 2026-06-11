// Util de URL de vídeo — sem dependência externa.
// Reconhece a plataforma e extrai o videoId quando aplicável (YouTube).

export type DetectedPlatform = "YOUTUBE" | "INSTAGRAM" | "TIKTOK";

export type ParsedVideo = {
  platform: DetectedPlatform;
  videoId: string | null;
};

/**
 * Detecta plataforma e extrai o videoId a partir da URL colada.
 * - YouTube (Shorts, youtu.be, watch?v=, embed) → { YOUTUBE, id }
 * - Instagram (reel/p/tv) → { INSTAGRAM, null }
 * - TikTok → { TIKTOK, null }
 * - URL não reconhecida → null
 */
export function parseVideoUrl(url: string): ParsedVideo | null {
  const u = url.trim();

  const yt = u.match(
    /(?:youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/,
  );
  if (yt) return { platform: "YOUTUBE", videoId: yt[1] };

  if (/instagram\.com\/(reel|reels|p|tv)\//.test(u)) {
    return { platform: "INSTAGRAM", videoId: null };
  }

  if (/tiktok\.com\//.test(u)) {
    return { platform: "TIKTOK", videoId: null };
  }

  return null;
}

/** Thumbnail pública do YouTube. hqdefault existe para qualquer vídeo (inclui Shorts). */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** URL de embed (usada no facade — iframe carregado só sob demanda). */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}
