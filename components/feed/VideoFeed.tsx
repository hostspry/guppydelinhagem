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
  Volume2,
  VolumeX,
  Share2,
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
import { instagramEmbedUrl, tiktokEmbedUrl } from "@/lib/utils/video";
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

// Embed do feed — UI limpa: esconde ao máximo os controles nativos do YouTube.
// Sempre entra MUDO (autoplay exige) + loop; play/pause e mute passam a ser
// controlados por código via postMessage (enablejsapi=1). IG/TikTok caem no
// embed padrão (não aceitam esses params).
//  controls=0      — sem barra de controles
//  modestbranding=1 — sem logo grande
//  rel=0           — sem "vídeos relacionados" de outros canais
//  iv_load_policy=3 — sem anotações
//  fs=0            — SEM botão de tela cheia (o "azul" que vazava sobre o Comprar)
//  playsinline=1   — toca embutido no iOS (não abre fullscreen)
//  cc_load_policy=0 — sem legendas automáticas
//  enablejsapi=1   — habilita comandos via postMessage (play/pause/mute)
function feedEmbedSrc(v: FeedVideo): string | null {
  if (!v.videoId) return null;
  if (v.platform === "YOUTUBE") {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      loop: "1",
      playlist: v.videoId, // loop de vídeo único exige playlist = o próprio id
      controls: "0",
      modestbranding: "1",
      rel: "0",
      iv_load_policy: "3",
      fs: "0",
      playsinline: "1",
      cc_load_policy: "0",
      enablejsapi: "1",
    });
    return `https://www.youtube.com/embed/${v.videoId}?${params.toString()}`;
  }
  if (v.platform === "INSTAGRAM") return instagramEmbedUrl(v.videoId);
  if (v.platform === "TIKTOK") return tiktokEmbedUrl(v.videoId);
  return null;
}

// Comando à YouTube IFrame API via postMessage (sem carregar a lib).
function postCmd(
  iframe: HTMLIFrameElement | null,
  func: "playVideo" | "pauseVideo" | "mute" | "unMute",
) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args: [] }),
    "*",
  );
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
  // Som desligado por padrão → autoplay mudo (navegador bloqueia autoplay c/ som).
  // O usuário liga o som com um toque (gesto). Persiste entre slides.
  const [som, setSom] = useState(false);
  const [pausado, setPausado] = useState(false); // play/pause por toque (postMessage)
  const iframeRef = useRef<HTMLIFrameElement>(null);
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
    setIdx(novo); // novo slide autoplaya (o iframe re-monta pela key=idx)
    setPausado(false); // novo vídeo começa tocando
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
  const embedSrc = feedEmbedSrc(current.video); // sempre entra mudo (autoplay)

  // Play/pause e som por código (postMessage). unMute precisa de gesto → ok (vem
  // de um clique). Ao trocar de slide o iframe re-monta mudo; reaplica o som no
  // onLoad se já estava ligado.
  function togglePlay() {
    const novo = !pausado;
    setPausado(novo);
    postCmd(iframeRef.current, novo ? "pauseVideo" : "playVideo");
  }
  function toggleSom() {
    const novo = !som;
    setSom(novo);
    postCmd(iframeRef.current, novo ? "unMute" : "mute");
  }
  function onIframeLoad() {
    if (som) postCmd(iframeRef.current, "unMute"); // reaplica som no novo slide
  }

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

  // Sem embed (ex.: id não resolvido) → abre no destino ao tocar.
  function abrirOriginal() {
    window.open(current.video.originalUrl, "_blank", "noopener,noreferrer");
  }

  // Compartilhar: só o LINK da página do produto (sem texto/preço). Share nativo
  // do dispositivo; fallback copia o link. No mobile esse link reabre o feed.
  async function compartilhar() {
    const url = `${window.location.origin}/loja/${p.slug}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ url });
      } catch {
        /* usuário cancelou — ignora */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
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
          {/* Thumbnail de fundo (poster) — aparece enquanto o iframe carrega. */}
          {current.video.thumbnailUrl && (
            <div className="absolute inset-0">
              <VideoThumb
                src={current.video.thumbnailUrl}
                alt={p.nome}
                sizes="(max-width: 480px) 100vw, 480px"
              />
            </div>
          )}

          {embedSrc ? (
            <>
              {/* Embed SOB DEMANDA: só o slide atual monta iframe (autoplay mudo).
                  key={idx} re-monta ao trocar. Controles nativos escondidos pelos
                  params; play/pause e som por postMessage. */}
              <iframe
                key={idx}
                ref={iframeRef}
                src={embedSrc}
                title={current.video.titulo || p.nome}
                onLoad={onIframeLoad}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
              {/* Camada de toque = play/pause (fica sobre o iframe, então o swipe
                  também funciona por cima dela). Ícone de play só quando pausado. */}
              <button
                type="button"
                onClick={togglePlay}
                aria-label={pausado ? "Tocar" : "Pausar"}
                className="absolute inset-0 z-10 flex items-center justify-center"
              >
                {pausado && (
                  <span className="bg-black/45 rounded-full p-5">
                    <Play className="w-9 h-9 text-white fill-white" aria-hidden="true" />
                  </span>
                )}
              </button>
            </>
          ) : (
            // Sem embed (id não resolvido) → poster com play que abre no destino.
            <button
              type="button"
              onClick={abrirOriginal}
              aria-label="Abrir vídeo"
              className="absolute inset-0 w-full h-full"
            >
              {!current.video.thumbnailUrl && (
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
          className="flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
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
          {/* Liga/desliga o som (autoplay entra mudo; unMute via postMessage). */}
          <button
            type="button"
            onClick={toggleSom}
            aria-label={som ? "Desativar som" : "Ativar som"}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          >
            {som ? (
              <Volume2 className="w-5 h-5" aria-hidden="true" />
            ) : (
              <VolumeX className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Setas ↑/↓ (lado direito) */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-3">
        <button
          type="button"
          onClick={anterior}
          aria-label="Vídeo anterior"
          className="flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        >
          <ChevronUp className="w-5 h-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={proximo}
          aria-label="Próximo vídeo"
          className="flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        >
          <ChevronDown className="w-5 h-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={compartilhar}
          aria-label="Compartilhar"
          className="flex items-center justify-center w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        >
          <Share2 className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Gaveta de compra (parte de baixo, vídeo visível acima) — degradê escuro
          pra o texto ficar legível sobre qualquer vídeo (claro ou escuro). */}
      <div
        className="absolute bottom-0 inset-x-0 z-20 pt-12 pb-4 px-4"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.9) 55%, rgba(0,0,0,0.5) 78%, transparent)",
        }}
      >
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
