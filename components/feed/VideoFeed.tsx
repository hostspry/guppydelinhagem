"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronUp,
  ChevronDown,
  Play,
  Minus,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { VideoThumb } from "@/components/admin/VideoThumb";
import { formatBRL } from "@/lib/utils/format";
import { calcularPrecos } from "@/lib/precos";
import { useCart } from "@/lib/stores/cart";
import {
  COMPOSICAO_LABEL,
  ORDEM_COMPOSICAO,
  composicaoDisponivel,
} from "@/lib/composicoes";
import {
  youtubeEmbedUrl,
  instagramEmbedUrl,
  tiktokEmbedUrl,
} from "@/lib/utils/video";
import type { FeedProduto, FeedVideo, FeedVariante } from "@/lib/queries/products";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

type Slide = {
  p: FeedProduto;
  video: FeedVideo;
  vIdx: number; // índice do vídeo dentro do produto (0-based)
  vTotal: number; // total de vídeos do produto
};

const PLATFORM_LABEL: Record<FeedVideo["platform"], string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

function embedSrcFor(v: FeedVideo): string | null {
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

// Quantas unidades da composição o pool (machos/fêmeas) sustenta. Igual à página
// de produto — não baixa estoque, só mostra a disponibilidade.
function unitsDoPool(p: FeedProduto, v: FeedVariante): number {
  const byM = v.qtdMachos > 0 ? Math.floor(p.estoqueMachos / v.qtdMachos) : Infinity;
  const byF = v.qtdFemeas > 0 ? Math.floor(p.estoqueFemeas / v.qtdFemeas) : Infinity;
  const u = Math.min(byM, byF);
  return Number.isFinite(u) ? Math.max(0, u) : 0;
}

export default function VideoFeed({
  produtos,
  descontoPixGlobalPercent,
  startSlug,
}: {
  produtos: FeedProduto[];
  descontoPixGlobalPercent: number;
  startSlug?: string;
}) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);

  // Achata produtos → slides (1 vídeo = 1 slide). Destaques já vêm primeiro do
  // servidor; os vídeos de um produto ficam em sequência.
  const slides = useMemo<Slide[]>(
    () =>
      produtos.flatMap((p) =>
        p.videos.map((video, vIdx) => ({
          p,
          video,
          vIdx,
          vTotal: p.videos.length,
        })),
      ),
    [produtos],
  );

  const startIdx = useMemo(() => {
    if (!startSlug) return 0;
    const i = slides.findIndex((s) => s.p.slug === startSlug);
    return i >= 0 ? i : 0;
  }, [slides, startSlug]);

  const N = slides.length;
  const [idx, setIdx] = useState(startIdx);
  const [playing, setPlaying] = useState(false);
  const current = slides[idx];

  // Composição/quantidade da gaveta (do produto atual).
  const [composicaoSel, setComposicaoSel] = useState<TipoComposicao | null>(
    () => slides[startIdx]?.p.variantes[0]?.composicao ?? null,
  );
  const [qtd, setQtd] = useState(1);

  // Swipe vertical (ref do toque) — declarado antes de qualquer early return.
  const touchY = useRef<number | null>(null);

  // Desktop não usa o feed (decisão fechada) — volta pro produto/loja.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches
    ) {
      router.replace(startSlug ? `/loja/${startSlug}` : "/");
    }
  }, [router, startSlug]);

  if (N === 0 || !current) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center text-white/80 text-sm">
        Nenhum vídeo disponível.
      </div>
    );
  }

  function irPara(novo: number) {
    const alvo = slides[novo];
    setIdx(novo);
    setPlaying(false); // novo slide começa no poster (embed sob demanda)
    // Trocou de PRODUTO → reseta composição/quantidade da gaveta.
    if (alvo.p.id !== current.p.id) {
      setComposicaoSel(alvo.p.variantes[0]?.composicao ?? null);
      setQtd(1);
    }
  }
  // Loop infinito nas duas direções.
  const proximo = () => irPara((idx + 1) % N);
  const anterior = () => irPara((idx - 1 + N) % N);

  // Swipe vertical: arrastar pra cima = próximo; pra baixo = anterior.
  function onTouchStart(e: React.TouchEvent) {
    touchY.current = e.changedTouches[0]?.clientY ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchY.current == null) return;
    const dy = touchY.current - (e.changedTouches[0]?.clientY ?? touchY.current);
    touchY.current = null;
    if (dy > 50) proximo();
    else if (dy < -50) anterior();
  }

  // ── Preço/variante/estoque do produto atual (fonte única lib/precos) ──
  const p = current.p;
  const variant =
    p.variantes.find((v) => v.composicao === composicaoSel) ??
    p.variantes[0] ??
    null;
  const precoBase = variant ? variant.preco : p.preco;
  const precos = calcularPrecos(
    {
      precoBase,
      descontoPixProprio: p.descontoPix,
      usarDescontoPixGlobal: p.usarDescontoPixGlobal,
    },
    { descontoPixGlobalPercent },
  );
  const estoqueAtual = variant ? unitsDoPool(p, variant) : p.estoque;
  const semEstoque = estoqueAtual <= 0;
  const pool = { machos: p.estoqueMachos, femeas: p.estoqueFemeas };
  const embedSrc = embedSrcFor(current.video);

  function escolherComposicao(c: TipoComposicao) {
    setComposicaoSel(c);
    setQtd(1);
  }

  function adicionar() {
    addItem(
      {
        produtoId: p.id,
        variantId: variant ? variant.id : p.id,
        composicao: variant ? variant.composicao : null,
        composicaoLabel: variant ? COMPOSICAO_LABEL[variant.composicao] : null,
        nome: p.nome,
        slug: p.slug,
        precoPix: precos.precoPix,
        precoCheio: precos.precoCartao,
        qtdPeixes: variant ? variant.qtdMachos + variant.qtdFemeas : 0,
        thumbnail: current.video.thumbnailUrl,
        estoque: estoqueAtual,
      },
      qtd,
    );
  }
  function comprarAgora() {
    adicionar();
    router.push("/checkout");
  }
  function adicionarECar() {
    adicionar();
    toast.success("Adicionado ao carrinho ✓");
  }

  function tocar() {
    if (embedSrc) setPlaying(true);
    else
      window.open(current.video.originalUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Área do vídeo (9:16 centralizado) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full max-w-[480px] mx-auto bg-black">
          {/* Embed sob demanda: só monta o iframe do slide atual ao tocar. */}
          {playing && embedSrc ? (
            <iframe
              key={`${idx}-${current.video.originalUrl}`}
              src={embedSrc}
              title={current.video.titulo || p.nome}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={tocar}
              aria-label="Tocar vídeo"
              className="absolute inset-0 w-full h-full"
            >
              {current.video.thumbnailUrl ? (
                <VideoThumb
                  src={current.video.thumbnailUrl}
                  alt={p.nome}
                  sizes="(max-width: 480px) 100vw, 480px"
                />
              ) : (
                <div className="w-full h-full bg-neutral-900" />
              )}
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/45 rounded-full p-5">
                <Play className="w-9 h-9 text-white fill-white" aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Top bar: fechar + plataforma + "X de N" */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Fechar"
          className="flex items-center justify-center w-11 h-11 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2">
          {current.vTotal > 1 && (
            <span className="text-white text-xs font-medium bg-black/50 rounded-full px-2.5 py-1">
              vídeo {current.vIdx + 1} de {current.vTotal}
            </span>
          )}
          <span className="text-white/90 text-[11px] font-semibold bg-black/50 rounded-full px-2.5 py-1">
            {PLATFORM_LABEL[current.video.platform]}
          </span>
        </div>
      </div>

      {/* Setas ↑/↓ (lado direito) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        <button
          type="button"
          onClick={anterior}
          aria-label="Vídeo anterior"
          className="flex items-center justify-center w-11 h-11 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <ChevronUp className="w-5 h-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={proximo}
          aria-label="Próximo vídeo"
          className="flex items-center justify-center w-11 h-11 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <ChevronDown className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Gaveta de compra (parte de baixo, vídeo visível acima) */}
      <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black via-black/95 to-black/0 pt-10 pb-4 px-4">
        <div className="max-w-[480px] mx-auto space-y-3 text-white">
          <div>
            <h2 className="text-base font-bold leading-tight">{p.nome}</h2>
            {/* Preço: Pix com desconto + cheio do cartão legível (lib/precos) */}
            <div className="flex items-end gap-2 flex-wrap mt-1">
              <span className="text-green-400 text-2xl font-bold leading-none">
                {formatBRL(precos.precoPix)}
              </span>
              <span className="text-green-300 text-xs font-semibold pb-0.5">
                no Pix
              </span>
              {precos.descontoPixPercent > 0 && (
                <span className="text-[10px] font-bold text-green-900 bg-green-300 px-1.5 py-0.5 rounded-full">
                  {precos.descontoPixPercent}% OFF
                </span>
              )}
            </div>
            <p className="text-white/70 text-xs mt-0.5">
              {formatBRL(precos.precoCartao)} no cartão · até {p.parcelasMax}x
            </p>
          </div>

          {/* Composição (variantes do produto) */}
          {p.variantes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ORDEM_COMPOSICAO.filter((c) =>
                p.variantes.some((v) => v.composicao === c),
              ).map((c) => {
                const v = p.variantes.find((x) => x.composicao === c)!;
                const ativo = c === composicaoSel;
                const zerado = !composicaoDisponivel(v, pool);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => escolherComposicao(c)}
                    disabled={zerado}
                    className={`min-h-9 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      ativo
                        ? "border-secondary bg-secondary text-white"
                        : "border-white/30 text-white/90 hover:border-white"
                    } ${zerado ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {COMPOSICAO_LABEL[c]}
                  </button>
                );
              })}
            </div>
          )}

          {semEstoque ? (
            <p className="text-amber-300 text-sm font-medium">
              Esgotado nesta composição.
            </p>
          ) : (
            <div className="flex items-center gap-3">
              {/* Quantidade */}
              <div className="flex items-center border border-white/30 rounded-full">
                <button
                  type="button"
                  onClick={() => setQtd((q) => Math.max(1, q - 1))}
                  disabled={qtd <= 1}
                  aria-label="Diminuir quantidade"
                  className="flex items-center justify-center w-11 h-11 text-white disabled:opacity-30"
                >
                  <Minus size={15} aria-hidden="true" />
                </button>
                <span className="w-7 text-center text-sm font-semibold tabular-nums">
                  {qtd}
                </span>
                <button
                  type="button"
                  onClick={() => setQtd((q) => Math.min(estoqueAtual, q + 1))}
                  disabled={qtd >= estoqueAtual}
                  aria-label="Aumentar quantidade"
                  className="flex items-center justify-center w-11 h-11 text-white disabled:opacity-30"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>

              {/* Comprar agora (primário) */}
              <button
                type="button"
                onClick={comprarAgora}
                className="flex-1 min-h-11 bg-secondary text-white text-sm font-bold rounded-full hover:brightness-110 transition-all"
              >
                Comprar agora
              </button>

              {/* + Carrinho (secundário) */}
              <button
                type="button"
                onClick={adicionarECar}
                aria-label="Adicionar ao carrinho"
                className="flex items-center justify-center w-11 h-11 shrink-0 border-2 border-white/70 text-white rounded-full hover:bg-white/10 transition-all"
              >
                <ShoppingCart size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
