"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Play, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import { VideoThumb } from "@/components/admin/VideoThumb";
import { formatBRL } from "@/lib/utils/format";
import {
  youtubeEmbedUrl,
  instagramEmbedUrl,
  tiktokEmbedUrl,
} from "@/lib/utils/video";
import { useCart, selectTotalPeixes } from "@/lib/stores/cart";
import { whatsappLink, MAX_PEIXES_POR_CAIXA } from "@/lib/constants";
import type { PublicProductCard } from "@/lib/queries/products";

type CardVideo = NonNullable<PublicProductCard["video"]>;

const PLATFORM_LABEL: Record<CardVideo["platform"], string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

const PLATFORM_COLOR: Record<CardVideo["platform"], string> = {
  YOUTUBE: "bg-red-600",
  INSTAGRAM: "bg-pink-600",
  TIKTOK: "bg-gray-900",
};

/** URL de embed; null quando não há id resolvido (cai no fallback de nova aba). */
function embedSrcFor(v: CardVideo): string | null {
  if (!v.videoId) return null;
  switch (v.platform) {
    case "YOUTUBE":
      return youtubeEmbedUrl(v.videoId);
    case "INSTAGRAM":
      return instagramEmbedUrl(v.videoId);
    case "TIKTOK":
      return tiktokEmbedUrl(v.videoId);
    default:
      return null;
  }
}

export default function ProductCard({ product }: { product: PublicProductCard }) {
  const [qtd, setQtd] = useState(1);
  const [playing, setPlaying] = useState(false);
  // Guarda de hidratação: o store persistido (localStorage) só existe no client.
  // Sem isto, o aviso de >10 daria mismatch entre SSR (0) e client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const addItem = useCart((s) => s.addItem);
  const totalPeixes = useCart(selectTotalPeixes);

  const semEstoque = product.estoque <= 0;
  const temDescontoPix =
    product.descontoPix != null && product.descontoPix > 0;
  const precoPix = temDescontoPix
    ? product.preco * (1 - product.descontoPix! / 100)
    : product.preco;
  const valorParcela = product.preco / product.parcelasMax;
  const embedSrc = product.video ? embedSrcFor(product.video) : null;
  const excedeCaixa = mounted && totalPeixes > MAX_PEIXES_POR_CAIXA;

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handlePlay(e: React.MouseEvent) {
    stop(e);
    if (embedSrc) setPlaying(true);
    else if (product.video) {
      // Sem embed (id não resolvido) — abre no destino, como no admin.
      window.open(product.video.originalUrl, "_blank", "noopener,noreferrer");
    }
  }

  function adicionar() {
    addItem(
      {
        produtoId: product.id,
        nome: product.nome,
        slug: product.slug,
        precoPix,
        precoCheio: product.preco,
        thumbnail: product.video?.thumbnailUrl ?? null,
        estoque: product.estoque,
      },
      qtd,
    );
    toast.success("Adicionado ao carrinho ✓");
  }

  function handleAdd(e: React.MouseEvent) {
    stop(e);
    adicionar();
  }

  function handleComprar(e: React.MouseEvent) {
    stop(e);
    adicionar();
    // Checkout ainda não existe — leva o item ao WhatsApp.
    const msg = `Olá! Quero comprar: ${product.nome} (quantidade: ${qtd}). Pode me ajudar a fechar o pedido?`;
    window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-border flex flex-col">
      {/* Vídeo principal 9:16 — facade: iframe só carrega ao tocar */}
      <div className="relative aspect-[9/16] overflow-hidden bg-muted">
        {playing && embedSrc ? (
          <>
            <iframe
              src={embedSrc}
              title={product.nome}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                setPlaying(false);
              }}
              aria-label="Fechar vídeo"
              // Alvo de toque de 44x44 (mínimo mobile); o círculo visível fica no
              // span interno, então o botão não incha além do ícone.
              className="absolute top-0 right-0 z-10 flex items-center justify-center w-11 h-11 text-white"
            >
              <span className="bg-black/60 hover:bg-black/80 rounded-full p-1.5 transition-colors">
                <X className="w-4 h-4" aria-hidden="true" />
              </span>
            </button>
          </>
        ) : (
          <>
            {/* Thumbnail navega para a página do produto (4b) */}
            <Link
              href={`/loja/${product.slug}`}
              className="absolute inset-0 block"
              aria-label={product.nome}
            >
              {product.video?.thumbnailUrl ? (
                <VideoThumb
                  src={product.video.thumbnailUrl}
                  alt={product.nome}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  sem mídia
                </div>
              )}
            </Link>

            {product.video && (
              <span
                className={`absolute top-2 left-2 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full ${PLATFORM_COLOR[product.video.platform]}`}
              >
                {PLATFORM_LABEL[product.video.platform]}
              </span>
            )}

            {/* Play centralizado: só o círculo intercepta o clique (resto navega) */}
            {product.video?.thumbnailUrl && !semEstoque && (
              <button
                type="button"
                onClick={handlePlay}
                aria-label="Tocar vídeo"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/60 rounded-full p-3 transition-colors"
              >
                <Play className="w-6 h-6 text-white fill-white" aria-hidden="true" />
              </button>
            )}

            {semEstoque && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                <span className="bg-white text-primary text-xs font-semibold px-3 py-1 rounded-full">
                  Sem estoque
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4 space-y-2 flex flex-col flex-1">
        <Link href={`/loja/${product.slug}`} className="block">
          <p className="text-primary font-semibold text-sm leading-tight line-clamp-2 hover:text-accent transition-colors">
            {product.nome}
          </p>
        </Link>

        {/* Preço Pix em destaque (verde) */}
        <div>
          <p className="text-green-600 text-2xl font-bold leading-none">
            {formatBRL(precoPix)}
          </p>
          <p className="flex items-center gap-1 text-green-700 text-xs font-medium mt-1">
            <Check size={13} className="shrink-0" aria-hidden="true" />
            à vista no Pix
          </p>
        </div>

        {temDescontoPix && (
          <p className="text-sm text-muted-foreground">
            <span className="line-through">{formatBRL(product.preco)}</span> no
            cartão
          </p>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground font-light">
          <CalendarDays size={12} className="shrink-0" aria-hidden="true" />
          Em até {product.parcelasMax}x de {formatBRL(valorParcela)} sem juros
        </p>

        {/* Seletor de quantidade + botões (não navegam) */}
        <div className="mt-auto pt-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Quantidade</span>
            <div className="flex items-center border border-border rounded-lg">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setQtd((q) => Math.max(1, q - 1));
                }}
                disabled={semEstoque || qtd <= 1}
                aria-label="Diminuir quantidade"
                className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors"
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <span className="w-8 text-center text-sm font-medium tabular-nums">
                {qtd}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  setQtd((q) => Math.min(product.estoque, q + 1));
                }}
                disabled={semEstoque || qtd >= product.estoque}
                aria-label="Aumentar quantidade"
                className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors"
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleComprar}
            disabled={semEstoque}
            className="w-full bg-green-600 text-white text-sm font-semibold py-2.5 rounded-pill hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Comprar agora
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={semEstoque}
            className="w-full flex items-center justify-center gap-1.5 border border-primary text-primary text-sm font-semibold py-2.5 rounded-pill hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <ShoppingCart size={15} aria-hidden="true" />
            Adicionar ao carrinho
          </button>

          {excedeCaixa && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-md p-2 leading-snug">
              Para mais de {MAX_PEIXES_POR_CAIXA} peixes, o frete precisa ser
              recalculado.{" "}
              <a
                href={whatsappLink(
                  "Olá! Tenho mais de 10 peixes no carrinho e gostaria de recalcular o frete para fechar o pedido.",
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-semibold underline hover:text-amber-900"
              >
                Fale com o criador no WhatsApp
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
