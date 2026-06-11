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

  // Instagram: extrai o shortcode (reel/p/tv) p/ usar no embed.
  const ig = u.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  if (ig) return { platform: "INSTAGRAM", videoId: ig[1] };

  // TikTok canônico já traz o id numérico. URLs curtas (vt.tiktok.com/XXXX) não
  // contêm o id — retornam null aqui e são resolvidas via redirect em
  // fetchVideoMetadata.
  const ttCanonical = u.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
  if (ttCanonical) return { platform: "TIKTOK", videoId: ttCanonical[1] };
  if (/tiktok\.com\//.test(u)) return { platform: "TIKTOK", videoId: null };

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

/**
 * 4 frames públicos do vídeo para escolher a capa: hqdefault (padrão) + os
 * frames de início/meio/fim (1/2/3.jpg). Permite trocar quando a thumb
 * automática pega uma cena ruim.
 */
export function youtubeFrameUrls(videoId: string): string[] {
  const base = `https://img.youtube.com/vi/${videoId}`;
  return [`${base}/hqdefault.jpg`, `${base}/1.jpg`, `${base}/2.jpg`, `${base}/3.jpg`];
}

/**
 * Embed do Instagram (shortcode do reel/post). O caminho /p/ é o canônico do
 * Instagram para qualquer mídia e serve tanto post quanto reel — evita o 404
 * que /reel/ dava quando o link original era um /p/.
 */
export function instagramEmbedUrl(shortcode: string): string {
  return `https://www.instagram.com/p/${shortcode}/embed`;
}

/** Embed do TikTok (id numérico do vídeo). */
export function tiktokEmbedUrl(videoId: string): string {
  return `https://www.tiktok.com/embed/v2/${videoId}`;
}
