"use client";

import { useState } from "react";
import {
  Check,
  Play,
  Minus,
  Plus,
  ShoppingCart,
  X,
  Truck,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { VideoThumb } from "@/components/admin/VideoThumb";
import ProductFreteEstimator from "./ProductFreteEstimator";
import { formatBRL } from "@/lib/utils/format";
import {
  youtubeEmbedUrl,
  instagramEmbedUrl,
  tiktokEmbedUrl,
} from "@/lib/utils/video";
import { useCart } from "@/lib/stores/cart";
import { whatsappLink, MARCHEZI_SIGNATURE } from "@/lib/constants";
import { SEXO_COMPOSICAO_OPCOES } from "@/lib/validations/product";
import type {
  ProductDetail as ProductDetailData,
  ProductDetailVideo,
} from "@/lib/queries/products";

const PLATFORM_LABEL: Record<ProductDetailVideo["platform"], string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};
const PLATFORM_COLOR: Record<ProductDetailVideo["platform"], string> = {
  YOUTUBE: "bg-red-600",
  INSTAGRAM: "bg-pink-600",
  TIKTOK: "bg-gray-900",
};

function embedSrcFor(v: ProductDetailVideo): string | null {
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

function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ProductDetail({ product }: { product: ProductDetailData }) {
  const [qtd, setQtd] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState(product.videos[0]?.id ?? null);
  const [descExpandida, setDescExpandida] = useState(false);
  const addItem = useCart((s) => s.addItem);

  const selected =
    product.videos.find((v) => v.id === selectedId) ?? product.videos[0] ?? null;
  const embedSrc = selected ? embedSrcFor(selected) : null;

  const semEstoque = product.estoque <= 0;
  const temDescontoPix =
    product.descontoPix != null && product.descontoPix > 0;
  const precoPix = temDescontoPix
    ? product.preco * (1 - product.descontoPix! / 100)
    : product.preco;
  const valorParcela = product.preco / product.parcelasMax;
  const capa = product.videos.find((v) => v.principal)?.thumbnailUrl ?? null;

  // Assinatura Marchezi vai num card destacado — separa do texto da linhagem.
  const lineage = product.descricao.replace(MARCHEZI_SIGNATURE, "").trim();
  const lineageParags = lineage
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const descLonga = lineage.length > 320;

  const sexoLabel = product.sexoComposicao
    ? SEXO_COMPOSICAO_OPCOES.find((o) => o.value === product.sexoComposicao)
        ?.label ?? product.sexoComposicao
    : null;

  // Ficha técnica — ordem do brief; só linhas com valor.
  const ficha: [string, string | null][] = [
    ["Padrão / cor", product.padraoCor],
    ["Cauda", product.cauda],
    ["Característica", product.caracteristica],
    ["Sexo / composição", sexoLabel],
    ["Origem", product.origem],
    ["Temperatura", product.temperatura],
    ["pH", product.ph],
    ["Alimentação", product.alimentacao],
    ["Expectativa de vida", product.expectativaVida],
    ["Porte", product.porte],
  ];
  const fichaRows = ficha.filter(
    (row): row is [string, string] => !!row[1] && row[1].trim() !== "",
  );

  function selectVideo(id: string) {
    setSelectedId(id);
    setPlaying(false);
  }
  function handlePlay() {
    if (embedSrc) setPlaying(true);
    else if (selected)
      window.open(selected.originalUrl, "_blank", "noopener,noreferrer");
  }
  function adicionar() {
    addItem(
      {
        produtoId: product.id,
        nome: product.nome,
        slug: product.slug,
        precoPix,
        precoCheio: product.preco,
        thumbnail: capa,
        estoque: product.estoque,
      },
      qtd,
    );
    toast.success("Adicionado ao carrinho ✓");
  }
  function handleComprar() {
    adicionar();
    const msg = `Olá! Quero comprar: ${product.nome} (quantidade: ${qtd}). Pode me ajudar a fechar o pedido?`;
    window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="container-site py-8 space-y-10">
      {/* ── Bloco de compra ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8 items-start">
        {/* Vídeo */}
        <div className="space-y-3">
          <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-muted">
            {playing && embedSrc ? (
              <>
                <iframe
                  src={embedSrc}
                  title={selected?.titulo || product.nome}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                <button
                  type="button"
                  onClick={() => setPlaying(false)}
                  aria-label="Fechar vídeo"
                  className="absolute top-0 right-0 z-10 flex items-center justify-center w-11 h-11 text-white"
                >
                  <span className="bg-black/60 hover:bg-black/80 rounded-full p-1.5 transition-colors">
                    <X className="w-4 h-4" aria-hidden="true" />
                  </span>
                </button>
              </>
            ) : selected ? (
              <>
                {selected.thumbnailUrl ? (
                  <VideoThumb
                    src={selected.thumbnailUrl}
                    alt={product.nome}
                    sizes="(max-width: 1024px) 100vw, 300px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                    sem mídia
                  </div>
                )}
                <span
                  className={`absolute top-2 left-2 text-white text-[11px] font-semibold px-2 py-0.5 rounded-full ${PLATFORM_COLOR[selected.platform]}`}
                >
                  {PLATFORM_LABEL[selected.platform]}
                </span>
                <button
                  type="button"
                  onClick={handlePlay}
                  aria-label="Tocar vídeo"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/60 rounded-full p-4 transition-colors"
                >
                  <Play className="w-7 h-7 text-white fill-white" aria-hidden="true" />
                </button>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                sem vídeo
              </div>
            )}
          </div>

          {product.videos.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {product.videos.map((v) => {
                const ativo = v.id === selected?.id;
                return (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => selectVideo(v.id)}
                    aria-label={`Ver ${v.titulo || PLATFORM_LABEL[v.platform]}`}
                    className={`relative w-14 aspect-[9/16] rounded-lg overflow-hidden border-2 transition-colors ${
                      ativo
                        ? "border-secondary"
                        : "border-transparent hover:border-border"
                    }`}
                  >
                    {v.thumbnailUrl ? (
                      <VideoThumb src={v.thumbnailUrl} alt="" sizes="56px" />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Info / compra */}
        <div className="space-y-5">
          <div className="space-y-2">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-secondary bg-secondary/10 px-2.5 py-0.5 rounded-full">
              {product.categoria}
            </span>
            <h1 className="text-primary text-2xl sm:text-3xl font-bold leading-tight">
              {product.nome}
            </h1>
            {product.descricaoCurta && (
              <p className="text-muted-foreground text-sm">{product.descricaoCurta}</p>
            )}
          </div>

          {/* Preço */}
          <div className="space-y-1">
            <div className="flex items-end gap-2 flex-wrap">
              <span className="text-green-600 text-3xl font-bold leading-none">
                {formatBRL(precoPix)}
              </span>
              {temDescontoPix && (
                <span className="text-[11px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  −{product.descontoPix}% no Pix
                </span>
              )}
            </div>
            <p className="flex items-center gap-1 text-green-700 text-sm font-medium">
              <Check size={14} className="shrink-0" aria-hidden="true" />
              à vista no Pix
            </p>
            {temDescontoPix && (
              <p className="text-sm text-muted-foreground">
                <span className="line-through">{formatBRL(product.preco)}</span> no
                cartão — em até {product.parcelasMax}x de {formatBRL(valorParcela)} sem
                juros
              </p>
            )}
          </div>

          {/* Quantidade */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Quantidade</span>
            <div className="flex items-center border border-border rounded-lg">
              <button
                type="button"
                onClick={() => setQtd((q) => Math.max(1, q - 1))}
                disabled={semEstoque || qtd <= 1}
                aria-label="Diminuir quantidade"
                className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <span className="w-10 text-center font-medium tabular-nums">{qtd}</span>
              <button
                type="button"
                onClick={() => setQtd((q) => Math.min(product.estoque, q + 1))}
                disabled={semEstoque || qtd >= product.estoque}
                aria-label="Aumentar quantidade"
                className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            {semEstoque && (
              <span className="text-sm font-semibold text-secondary">Sem estoque</span>
            )}
          </div>

          {/* Botões — proporcionais (max-width no desktop, full no mobile) */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:max-w-md">
            <button
              type="button"
              onClick={handleComprar}
              disabled={semEstoque}
              className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-pill hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Comprar agora
            </button>
            <button
              type="button"
              onClick={adicionar}
              disabled={semEstoque}
              className="flex-1 flex items-center justify-center gap-2 border border-primary text-primary font-semibold py-3 rounded-pill hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ShoppingCart size={17} aria-hidden="true" />
              Adicionar ao carrinho
            </button>
          </div>

          {/* Frete — logo abaixo dos botões */}
          <div className="max-w-md">
            <ProductFreteEstimator qtd={qtd} />
          </div>

          {/* Selos de confiança em caixinhas */}
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="flex items-center gap-2 border border-border rounded-lg p-3 text-sm text-primary">
              <ShieldCheck size={18} className="shrink-0 text-green-600" aria-hidden="true" />
              Chegada viva garantida
            </div>
            <div className="flex items-center gap-2 border border-border rounded-lg p-3 text-sm text-primary">
              <Truck size={18} className="shrink-0 text-green-600" aria-hidden="true" />
              Envio para todo o Brasil
            </div>
          </div>
        </div>
      </div>

      {/* ── Ficha técnica ── */}
      {fichaRows.length > 0 && (
        <section className="max-w-2xl">
          <h2 className="text-primary text-lg font-semibold mb-3">Ficha técnica</h2>
          <dl className="rounded-xl border border-border overflow-hidden">
            {fichaRows.map(([label, value], i) => (
              <div
                key={label}
                className={`flex justify-between gap-4 px-4 py-2.5 text-sm ${
                  i % 2 === 0 ? "bg-white" : "bg-muted/40"
                }`}
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-primary font-medium text-right">
                  {capFirst(value)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ── Sobre a linhagem ── */}
      {lineageParags.length > 0 && (
        <section className="max-w-2xl">
          <h2 className="text-primary text-lg font-semibold mb-3">Sobre a linhagem</h2>
          <div
            className={`space-y-3 text-text leading-relaxed ${
              descLonga && !descExpandida ? "line-clamp-5" : ""
            }`}
          >
            {lineageParags.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
          </div>
          {descLonga && (
            <button
              type="button"
              onClick={() => setDescExpandida((v) => !v)}
              className="mt-2 text-sm font-semibold text-secondary hover:underline"
            >
              {descExpandida ? "Ler menos" : "Ler mais"}
            </button>
          )}
        </section>
      )}

      {/* ── Assinatura Marchezi (destacada) ── */}
      <section className="max-w-2xl">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={18} className="text-accent" aria-hidden="true" />
            <h2 className="text-primary font-semibold">Criação Marchezi Guppy Farm</h2>
          </div>
          <div className="space-y-3 text-sm text-text leading-relaxed">
            {MARCHEZI_SIGNATURE.split(/\n\s*\n/).map((p, i) => (
              <p key={i}>{p.trim()}</p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
