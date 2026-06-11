"use client";

import { useState } from "react";
import Image from "next/image";
import { youtubeHqToMaxRes } from "@/lib/utils/video";
import { isConfiguredImageHost } from "@/lib/utils/image";

/**
 * Thumbnail de vídeo (fill + object-cover) que tenta a versão HD (maxres) das
 * thumbnails canônicas do YouTube e cai para a hqdefault via onError quando a
 * maxres não existe (vídeo sem maxres → 404). Para qualquer outra URL, exibe
 * direto. object-cover recorta o miolo da 16:9 dentro de containers 9:16 — sem
 * barra preta nem distorção. O container precisa ser `relative` (fill).
 */
export function VideoThumb({
  src,
  alt,
  sizes,
}: {
  src: string;
  alt: string;
  sizes: string;
}) {
  const maxres = youtubeHqToMaxRes(src);
  const [failed, setFailed] = useState<string | null>(null);
  const useMax = maxres !== null && failed !== maxres;
  const finalSrc = useMax ? maxres : src;
  return (
    <Image
      src={finalSrc}
      alt={alt}
      fill
      sizes={sizes}
      className="object-cover"
      unoptimized={!isConfiguredImageHost(finalSrc)}
      onError={useMax ? () => setFailed(maxres) : undefined}
    />
  );
}
