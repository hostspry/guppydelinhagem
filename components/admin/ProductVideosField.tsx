"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Plus, Eye, Trash2, Star, X } from "lucide-react";
import { toast } from "sonner";
import type { VideoDraft } from "@/lib/validations/product";
import { fetchVideoMetadata } from "@/actions/products";
import { youtubeEmbedUrl } from "@/lib/utils/video";
import { isConfiguredImageHost } from "@/lib/utils/image";

type Props = {
  value: VideoDraft[];
  onChange: (videos: VideoDraft[]) => void;
};

const PLATFORM_LABEL: Record<VideoDraft["platform"], string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

const PLATFORM_COLOR: Record<VideoDraft["platform"], string> = {
  YOUTUBE: "bg-red-100 text-red-700",
  INSTAGRAM: "bg-pink-100 text-pink-700",
  TIKTOK: "bg-gray-900 text-white",
};

function PlatformBadge({ platform }: { platform: VideoDraft["platform"] }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${PLATFORM_COLOR[platform]}`}
    >
      {PLATFORM_LABEL[platform]}
    </span>
  );
}

export function ProductVideosField({ value, onChange }: Props) {
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [playing, setPlaying] = useState<VideoDraft | null>(null);

  const principal = value.find((v) => v.principal) ?? value[0];
  const adicionais = value.filter((v) => v !== principal);

  function handleAdd() {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (value.some((v) => v.originalUrl === trimmed)) {
      toast.error("Esse vídeo já foi adicionado.");
      return;
    }
    startTransition(async () => {
      const result = await fetchVideoMetadata(trimmed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const novo: VideoDraft = {
        platform: result.data.platform,
        videoId: result.data.videoId,
        originalUrl: trimmed,
        titulo: result.data.titulo,
        thumbnailUrl: result.data.thumbnailUrl,
        principal: value.length === 0, // primeiro vídeo vira principal
      };
      onChange([...value, novo]);
      setUrl("");
    });
  }

  function patch(target: VideoDraft, partial: Partial<VideoDraft>) {
    onChange(value.map((v) => (v === target ? { ...v, ...partial } : v)));
  }

  function setPrincipal(target: VideoDraft) {
    onChange(value.map((v) => ({ ...v, principal: v === target })));
  }

  function remove(target: VideoDraft) {
    const eraPrincipal = target.principal;
    let next = value.filter((v) => v !== target);
    // Se removeu o principal e sobraram vídeos, promove o primeiro.
    if (eraPrincipal && next.length > 0 && !next.some((v) => v.principal)) {
      next = next.map((v, i) => ({ ...v, principal: i === 0 }));
    }
    onChange(next);
  }

  function openFacade(v: VideoDraft) {
    if (v.platform === "YOUTUBE" && v.videoId) {
      setPlaying(v); // iframe só monta agora (facade)
    } else {
      // IG/TikTok não têm embed limpo por URL — abre no destino.
      window.open(v.originalUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
      <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
        Vídeos
      </legend>

      {/* Adicionar por URL */}
      <div className="flex gap-2 mb-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Cole a URL do YouTube Short, Instagram ou TikTok"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#07366A] text-white text-sm font-medium rounded-md hover:brightness-125 disabled:opacity-50 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {isPending ? "Buscando…" : "Adicionar"}
        </button>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-gray-400">
          Nenhum vídeo. O primeiro adicionado vira o principal (capa).
        </p>
      )}

      {/* Principal */}
      {principal && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-[#0EA5E9] uppercase tracking-wide mb-1.5">
            Primário
          </p>
          <VideoRow
            video={principal}
            featured
            onPlay={() => openFacade(principal)}
            onRemove={() => remove(principal)}
            onPatch={(p) => patch(principal, p)}
          />
        </div>
      )}

      {/* Adicionais */}
      {adicionais.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Adicionais
          </p>
          <div className="space-y-2">
            {adicionais.map((v, i) => (
              <VideoRow
                key={v.id ?? `${v.originalUrl}-${i}`}
                video={v}
                onPlay={() => openFacade(v)}
                onRemove={() => remove(v)}
                onSetPrincipal={() => setPrincipal(v)}
                onPatch={(p) => patch(v, p)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Facade: iframe carregado só ao clicar em "ver" */}
      {playing && playing.videoId && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="relative w-full max-w-sm aspect-[9/16] bg-black rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPlaying(null)}
              aria-label="Fechar vídeo"
              className="absolute top-2 right-2 z-10 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <iframe
              src={youtubeEmbedUrl(playing.videoId)}
              title={playing.titulo || "Vídeo"}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}

function VideoRow({
  video,
  featured,
  onPlay,
  onRemove,
  onSetPrincipal,
  onPatch,
}: {
  video: VideoDraft;
  featured?: boolean;
  onPlay: () => void;
  onRemove: () => void;
  onSetPrincipal?: () => void;
  onPatch: (partial: Partial<VideoDraft>) => void;
}) {
  const manual = video.platform !== "YOUTUBE";

  return (
    <div
      className={`flex gap-3 p-2.5 rounded-md border ${
        featured ? "border-2 border-[#0EA5E9]" : "border-gray-200"
      }`}
    >
      {/* Thumbnail 9:16 */}
      <div className="relative w-14 shrink-0 aspect-[9/16] bg-gray-100 rounded overflow-hidden">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt={video.titulo || "Thumbnail do vídeo"}
            fill
            sizes="56px"
            className="object-cover"
            unoptimized={!isConfiguredImageHost(video.thumbnailUrl)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
            sem thumb
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <PlatformBadge platform={video.platform} />
          {manual && (
            <span className="text-[10px] text-amber-600">thumb manual</span>
          )}
        </div>

        {manual ? (
          <div className="space-y-1.5">
            <input
              value={video.titulo ?? ""}
              onChange={(e) => onPatch({ titulo: e.target.value })}
              placeholder="Título (manual)"
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#FF035C]"
            />
            <input
              value={video.thumbnailUrl ?? ""}
              onChange={(e) => onPatch({ thumbnailUrl: e.target.value })}
              placeholder="URL da thumbnail (manual)"
              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono focus:outline-none focus:border-[#FF035C]"
            />
          </div>
        ) : (
          <p className="text-sm text-[#07366A] font-medium truncate">
            {video.titulo || "(sem título)"}
          </p>
        )}

        <p className="text-[11px] text-gray-400 truncate mt-0.5">
          {video.originalUrl}
        </p>
      </div>

      {/* Ações */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onPlay}
          aria-label="Ver vídeo"
          className="text-gray-400 hover:text-[#07366A] p-1"
        >
          <Eye className="w-4 h-4" aria-hidden="true" />
        </button>
        {onSetPrincipal && (
          <button
            type="button"
            onClick={onSetPrincipal}
            aria-label="Tornar principal"
            title="Tornar principal"
            className="text-gray-400 hover:text-amber-500 p-1"
          >
            <Star className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover vídeo"
          className="text-gray-400 hover:text-[#FF035C] p-1"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
