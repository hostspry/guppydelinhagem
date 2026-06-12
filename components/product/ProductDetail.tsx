"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Check,
  Play,
  Minus,
  Plus,
  ShoppingCart,
  X,
  Trophy,
  Dna,
  Droplets,
  Clock,
  ShieldCheck,
  Truck,
  Wind,
  Headset,
  Package,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { VideoThumb } from "@/components/admin/VideoThumb";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import ProductFreteEstimator from "./ProductFreteEstimator";
import ProductFaq from "./ProductFaq";
import WaitlistForm from "./WaitlistForm";
import { formatBRL } from "@/lib/utils/format";
import {
  youtubeEmbedUrl,
  instagramEmbedUrl,
  tiktokEmbedUrl,
} from "@/lib/utils/video";
import { useCart } from "@/lib/stores/cart";
import { whatsappLink, stripMarcheziSignature } from "@/lib/constants";
import {
  PROVA_SOCIAL_VENDIDOS,
  PROVA_SOCIAL_CRIADOR,
  SELOS_TOPO,
  DIFERENCIAIS,
  SEGURANCA,
  INSTITUCIONAIS,
  MARCHEZI_NOTA,
  type IconKey,
} from "@/lib/product-content";
import { SEXO_COMPOSICAO_OPCOES } from "@/lib/validations/product";
import type {
  ProductDetail as ProductDetailData,
  ProductDetailVideo,
  PublicProductCard,
} from "@/lib/queries/products";

const ICONS: Record<IconKey, LucideIcon> = {
  trophy: Trophy,
  dna: Dna,
  droplets: Droplets,
  clock: Clock,
  shield: ShieldCheck,
  truck: Truck,
  wind: Wind,
  headset: Headset,
  package: Package,
};

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

export default function ProductDetail({
  product,
  relacionados,
}: {
  product: ProductDetailData;
  relacionados: PublicProductCard[];
}) {
  const [qtd, setQtd] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState(product.videos[0]?.id ?? null);
  const [descExpandida, setDescExpandida] = useState(false);
  const [barFill, setBarFill] = useState(0); // anima o preenchimento ao montar
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

  // Barra de disponibilidade estilo tanque: cheia em 50 unidades; o nível (cor +
  // rótulo) vem do estoque real, mas o número exato nunca é exibido.
  const fillPct = Math.min(product.estoque / 50, 1) * 100;
  const nivel =
    product.estoque >= 25
      ? { bar: "bg-green-500", text: "text-green-700", label: "Em estoque" }
      : product.estoque >= 10
        ? { bar: "bg-amber-500", text: "text-amber-700", label: "Estoque limitado" }
        : { bar: "bg-red-500", text: "text-red-600", label: "Últimas unidades!" };
  useEffect(() => setBarFill(fillPct), [fillPct]);

  const lineage = stripMarcheziSignature(product.descricao);
  const lineageParags = lineage
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const descLonga = lineage.length > 320;

  const sexoLabel = product.sexoComposicao
    ? SEXO_COMPOSICAO_OPCOES.find((o) => o.value === product.sexoComposicao)
        ?.label ?? product.sexoComposicao
    : null;

  // Ficha técnica em 2 colunas (ordem do brief). Só linhas com valor.
  type Row = [string, string | null];
  const filtra = (rows: Row[]) =>
    rows.filter((r): r is [string, string] => !!r[1] && r[1].trim() !== "");
  const fichaEsq = filtra([
    ["Padrão / cor", product.padraoCor],
    ["Sexo / composição", sexoLabel],
    ["Temperatura", product.temperatura],
    ["pH", product.ph],
  ]);
  const fichaDir = filtra([
    ["Alimentação", product.alimentacao],
    ["Expectativa de vida", product.expectativaVida],
    ["Origem", product.origem],
    ["Cauda", product.cauda],
    ["Característica", product.caracteristica],
  ]);
  const temFicha = fichaEsq.length + fichaDir.length > 0;

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
  const duvidasHref = whatsappLink(
    `Olá! Tenho dúvidas sobre: ${product.nome}.`,
  );

  function Selo({ icon, label }: { icon: IconKey; label: string }) {
    const Icon = ICONS[icon];
    return (
      <div className="flex items-center gap-2 border border-border rounded-lg p-2.5 text-xs text-primary">
        <Icon size={16} className="shrink-0 text-green-600" aria-hidden="true" />
        <span className="leading-tight">{label}</span>
      </div>
    );
  }

  return (
    <div className="container-site py-8 space-y-12">
      {/* ═══ Bloco de compra ═══ */}
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

          {/* Prova social honesta — sem estrelas/avaliações falsas */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 font-semibold text-primary">
              <Check size={15} className="text-green-600" aria-hidden="true" />
              {PROVA_SOCIAL_VENDIDOS}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Trophy size={15} className="text-accent" aria-hidden="true" />
              {PROVA_SOCIAL_CRIADOR}
            </span>
          </div>

          {/* Preço */}
          <div className="space-y-1">
            <div className="flex items-end gap-2 flex-wrap">
              <span className="text-green-600 text-3xl font-bold leading-none">
                {formatBRL(precoPix)}
              </span>
              <span className="text-green-700 text-sm font-medium pb-0.5">no Pix</span>
              {temDescontoPix && (
                <span className="text-[11px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                  {product.descontoPix}% OFF
                </span>
              )}
            </div>
            {temDescontoPix && (
              <p className="text-sm text-muted-foreground">
                De <span className="line-through">{formatBRL(product.preco)}</span> no
                cartão
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              ou em até {product.parcelasMax}x de {formatBRL(valorParcela)} sem juros
            </p>
          </div>

          {/* Frete — logo abaixo do preço */}
          <div className="max-w-md">
            <ProductFreteEstimator qtd={qtd} />
          </div>

          {/* Estoque + compra / lista de espera */}
          {semEstoque ? (
            <div className="max-w-md space-y-3">
              <WaitlistForm productId={product.id} />
              <a
                href={duvidasHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full border border-primary text-primary font-semibold py-3 rounded-pill hover:bg-primary/5 transition-all"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                Tirar dúvidas no WhatsApp
              </a>
            </div>
          ) : (
            <div className="space-y-4 max-w-md">
              {/* Disponibilidade — barra tipo tanque, sem expor o número exato */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-primary">
                    Disponibilidade
                  </span>
                  <span className={`text-xs font-semibold ${nivel.text}`}>
                    {nivel.label}
                  </span>
                </div>
                <div
                  className="h-3 w-full rounded-full bg-muted overflow-hidden"
                  role="meter"
                  aria-label={`Disponibilidade: ${nivel.label}`}
                >
                  <div
                    className={`h-full rounded-full ${nivel.bar} transition-[width] duration-700 ease-out`}
                    style={{ width: `${barFill}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Quantidade</span>
                <div className="flex items-center border border-border rounded-lg">
                  <button
                    type="button"
                    onClick={() => setQtd((q) => Math.max(1, q - 1))}
                    disabled={qtd <= 1}
                    aria-label="Diminuir quantidade"
                    className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <span className="w-10 text-center font-medium tabular-nums">{qtd}</span>
                  <button
                    type="button"
                    onClick={() => setQtd((q) => Math.min(product.estoque, q + 1))}
                    disabled={qtd >= product.estoque}
                    aria-label="Aumentar quantidade"
                    className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleComprar}
                  className="w-full bg-green-600 text-white font-semibold py-3 rounded-pill hover:brightness-110 transition-all"
                >
                  Comprar agora
                </button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={adicionar}
                    className="flex-1 flex items-center justify-center gap-2 border border-primary text-primary font-semibold py-3 rounded-pill hover:bg-primary/5 transition-all"
                  >
                    <ShoppingCart size={17} aria-hidden="true" />
                    Adicionar ao carrinho
                  </button>
                  <a
                    href={duvidasHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 border border-primary text-primary font-semibold py-3 rounded-pill hover:bg-primary/5 transition-all"
                  >
                    <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                    Tirar dúvidas
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Selos de confiança (4) */}
          <div className="grid grid-cols-2 gap-2 max-w-md">
            {SELOS_TOPO.map((s) => (
              <Selo key={s.label} icon={s.icon} label={s.label} />
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Diferenciais (fundo delimitado) ═══ */}
      <section className="rounded-2xl bg-bg-alt p-4 sm:p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {DIFERENCIAIS.map((d) => {
            const Icon = ICONS[d.icon];
            return (
              <div
                key={d.title}
                className="rounded-xl bg-white border border-border p-4 text-center space-y-1.5"
              >
                <Icon size={24} className="mx-auto text-accent" aria-hidden="true" />
                <p className="font-semibold text-primary text-sm">{d.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{d.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ Sobre a linhagem + Ficha técnica (lado a lado) ═══ */}
      {(lineageParags.length > 0 || temFicha) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Sobre a linhagem (esquerda) */}
          {lineageParags.length > 0 && (
            <div>
              <h2 className="text-primary text-lg font-semibold mb-3">
                Sobre a linhagem
              </h2>
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

              {/* Nota Marchezi — fecho integrado da descrição (divisória sutil,
                  não um box solto no meio da página) */}
              <div className="mt-4 pt-3 border-t border-border flex items-start gap-2">
                <Trophy size={15} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-muted-foreground italic leading-snug">
                  {MARCHEZI_NOTA}
                </p>
              </div>
            </div>
          )}

          {/* Ficha técnica (direita, em 2 sub-colunas) */}
          {temFicha && (
            <div>
              <h2 className="text-primary text-lg font-semibold mb-3">
                Ficha técnica
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 rounded-xl border border-border p-4">
                {[fichaEsq, fichaDir].map((col, ci) => (
                  <dl key={ci} className="divide-y divide-border/70">
                    {col.map(([label, value]) => (
                      <div
                        key={label}
                        className="flex justify-between gap-4 py-2 text-sm"
                      >
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="text-primary font-medium text-right">
                          {capFirst(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ═══ Blocos institucionais (placeholder Leva 2) ═══ */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {INSTITUCIONAIS.map((b) => (
          <div
            key={b.titulo}
            className="rounded-xl border border-border overflow-hidden flex flex-col"
          >
            {/* Imagem real quando houver; senão placeholder (ex: "Sobre a criação") */}
            <div className="relative aspect-video bg-muted">
              {b.imagem ? (
                <Image
                  src={b.imagem}
                  alt={b.titulo}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-contain p-3"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-1">
                  <ImageIcon size={28} aria-hidden="true" />
                  <span className="text-[11px]">imagem em breve</span>
                </div>
              )}
            </div>
            <div className="p-4 space-y-1.5">
              <h3 className="font-semibold text-primary">{b.titulo}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.texto}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ═══ Quem viu também viu (placeholder Leva 2: mesma categoria) ═══ */}
      {relacionados.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-primary text-lg font-semibold">
            Quem viu este peixe também viu
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {relacionados.map((r) => {
              const rPix =
                r.descontoPix != null && r.descontoPix > 0
                  ? r.preco * (1 - r.descontoPix / 100)
                  : r.preco;
              return (
                <Link
                  key={r.id}
                  href={`/loja/${r.slug}`}
                  className="shrink-0 w-40 group"
                >
                  <div className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted">
                    {r.video?.thumbnailUrl ? (
                      <VideoThumb src={r.video.thumbnailUrl} alt={r.nome} sizes="160px" />
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-primary line-clamp-2 group-hover:text-accent transition-colors">
                    {r.nome}
                  </p>
                  <p className="text-green-600 font-bold text-sm">{formatBRL(rPix)}</p>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ FAQ (2 colunas) ═══ */}
      <section>
        <h2 className="text-primary text-lg font-semibold mb-3">Perguntas frequentes</h2>
        <ProductFaq />
      </section>

      {/* ═══ Faixa "Sua compra 100% segura" (navy + selo) ═══ */}
      <section className="rounded-2xl bg-primary text-white p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 w-full">
            <h2 className="flex items-center gap-2 font-semibold mb-4">
              <ShieldCheck size={20} className="text-accent" aria-hidden="true" />
              Sua compra 100% segura
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {SEGURANCA.map((s) => {
                const Icon = ICONS[s.icon];
                return (
                  <div key={s.label} className="flex items-center gap-2 text-sm text-white/90">
                    <Icon size={18} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="leading-tight">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <Image
            src="/images/selo.png"
            alt="Garantia de Chegada Viva"
            width={128}
            height={128}
            className="w-24 h-24 sm:w-32 sm:h-32 object-contain shrink-0"
          />
        </div>
      </section>
    </div>
  );
}
