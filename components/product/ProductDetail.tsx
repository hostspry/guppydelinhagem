"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
  Tag,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { VideoThumb } from "@/components/admin/VideoThumb";
import ProductCardSimple from "@/components/product/ProductCardSimple";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { TricampeaoBadge } from "@/components/site/TricampeaoBadge";
import ProductFreteEstimator from "./ProductFreteEstimator";
import ProductFaq from "./ProductFaq";
import ProductShare from "./ProductShare";
import WaitlistForm from "./WaitlistForm";
import { formatBRL } from "@/lib/utils/format";
import { calcularPrecos } from "@/lib/precos";
import { precoComCampanha, type CampanhaInfo } from "@/lib/campanha-core";
import {
  youtubeEmbedUrl,
  instagramEmbedUrl,
  tiktokEmbedUrl,
} from "@/lib/utils/video";
import { useCart } from "@/lib/stores/cart";
import { whatsappLink, stripMarcheziSignature } from "@/lib/constants";
import { trackViewItem, trackAddToCart } from "@/lib/analytics";
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
import {
  COMPOSICAO_LABEL,
  ORDEM_COMPOSICAO,
  qtdPeixesDe,
  composicaoDisponivel,
} from "@/lib/composicoes";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";
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
  descontoPixGlobalPercent,
  campanha,
  freteGratis,
}: {
  product: ProductDetailData;
  relacionados: PublicProductCard[];
  descontoPixGlobalPercent: number;
  campanha: CampanhaInfo | null;
  freteGratis: { ativo: boolean; acimaDe: number | null };
}) {
  const router = useRouter();
  const [qtd, setQtd] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState(product.videos[0]?.id ?? null);
  const [descExpandida, setDescExpandida] = useState(false);
  const [barFill, setBarFill] = useState(0); // anima o preenchimento ao montar
  const addItem = useCart((s) => s.addItem);

  const selected =
    product.videos.find((v) => v.id === selectedId) ?? product.videos[0] ?? null;
  const embedSrc = selected ? embedSrcFor(selected) : null;

  // Composição: peixe tem variantes (trio padrão pré-selecionado); não-peixe não.
  const temVariantes = product.variantes.length > 0;
  const [composicaoSel, setComposicaoSel] = useState<TipoComposicao | null>(
    product.variantes[0]?.composicao ?? null,
  );
  const variant = temVariantes
    ? (product.variantes.find((v) => v.composicao === composicaoSel) ??
      product.variantes[0])
    : null;

  function escolherComposicao(c: TipoComposicao) {
    setComposicaoSel(c);
    setQtd(1); // estoque pode diferir entre composições
  }

  // Pool de estoque do produto (machos/fêmeas) — base da disponibilidade.
  const pool = { machos: product.estoqueMachos, femeas: product.estoqueFemeas };
  // Quantas unidades da composição o pool sustenta (cada uma consome a receita).
  function unitsDoPool(v: { qtdMachos: number; qtdFemeas: number }) {
    const byM = v.qtdMachos > 0 ? Math.floor(pool.machos / v.qtdMachos) : Infinity;
    const byF = v.qtdFemeas > 0 ? Math.floor(pool.femeas / v.qtdFemeas) : Infinity;
    const u = Math.min(byM, byF);
    return Number.isFinite(u) ? Math.max(0, u) : 0;
  }

  const precoBase = variant ? variant.preco : product.preco;
  const estoqueAtual = variant ? unitsDoPool(variant) : product.estoque;
  const qtdPeixesUnit = variant ? qtdPeixesDe(variant) : 1; // alimenta o frete
  const semEstoque = estoqueAtual <= 0;
  // Fonte única (lib/precos): cheio (cartão) + Pix com desconto efetivo (próprio
  // ou global), igual ao checkout. Não recalcula à mão.
  const precos = calcularPrecos(
    {
      precoBase,
      descontoPixProprio: product.descontoPix,
      usarDescontoPixGlobal: product.usarDescontoPixGlobal,
    },
    { descontoPixGlobalPercent },
  );
  const precoCheio = precos.precoCartao;
  const precoPix = precos.precoPix;
  const descontoPercent = precos.descontoPixPercent;
  const temDescontoPix = descontoPercent > 0;
  // Campanha (cupom) tem PRIORIDADE no bloco de preço. Recalcula o promo POR
  // VARIANTE (preço cheio da composição atual) — só exibição; o preço cobrado é
  // recalculado no servidor ao adicionar ao carrinho.
  const promo = campanha
    ? precoComCampanha(precoCheio, descontoPercent, campanha)
    : null;
  const capa = product.videos.find((v) => v.principal)?.thumbnailUrl ?? null;

  // GA4 view_item — uma vez por produto (preço Pix da composição inicial).
  const viewFired = useRef(false);
  useEffect(() => {
    if (viewFired.current) return;
    viewFired.current = true;
    trackViewItem({
      item_id: product.id,
      item_name: product.nome,
      price: precoPix,
      item_category: product.categoria,
    });
  }, [product.id, product.nome, product.categoria, precoPix]);

  // Barra de disponibilidade estilo tanque: cheia em 50 unidades; o nível (cor +
  // rótulo) vem do estoque real da composição, mas o número exato nunca é exibido.
  const fillPct = Math.min(estoqueAtual / 50, 1) * 100;
  const nivel =
    estoqueAtual >= 25
      ? { bar: "bg-green-500", text: "text-green-700", label: "Em estoque" }
      : estoqueAtual >= 10
        ? { bar: "bg-amber-500", text: "text-amber-700", label: "Estoque limitado" }
        : { bar: "bg-red-500", text: "text-red-600", label: "Últimas unidades!" };
  useEffect(() => setBarFill(fillPct), [fillPct]);

  const lineage = stripMarcheziSignature(product.descricao);
  const lineageParags = lineage
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const descLonga = lineage.length > 320;

  // Ficha técnica em 2 colunas (ordem do brief). Só linhas com valor.
  type Row = [string, string | null];
  const filtra = (rows: Row[]) =>
    rows.filter((r): r is [string, string] => !!r[1] && r[1].trim() !== "");
  const fichaEsq = filtra([
    ["Padrão / cor", product.padraoCor],
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
    // No mobile (<lg), o vídeo abre o feed tela cheia neste produto; no desktop
    // mantém o comportamento atual (embed inline / abrir no destino).
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      router.push(`/feed?p=${encodeURIComponent(product.slug)}`);
      return;
    }
    if (embedSrc) setPlaying(true);
    else if (selected)
      window.open(selected.originalUrl, "_blank", "noopener,noreferrer");
  }
  function adicionar() {
    addItem(
      {
        produtoId: product.id,
        variantId: variant ? variant.id : product.id,
        composicao: variant ? variant.composicao : null,
        composicaoLabel: variant ? COMPOSICAO_LABEL[variant.composicao] : null,
        nome: product.nome,
        slug: product.slug,
        precoPix,
        precoCheio,
        qtdPeixes: variant ? qtdPeixesDe(variant) : 0,
        thumbnail: capa,
        estoque: estoqueAtual,
      },
      qtd,
    );
    trackAddToCart(
      {
        item_id: product.id,
        item_name: product.nome,
        price: precoPix,
        item_category: product.categoria,
      },
      qtd,
    );
    toast.success("Adicionado ao carrinho ✓");
  }
  // "Comprar agora": adiciona ao carrinho (sem esvaziar o que já havia) e leva ao
  // /carrinho, onde o cliente revê os itens e pode continuar comprando.
  function handleComprar() {
    adicionar();
    router.push("/carrinho");
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-secondary bg-secondary/10 px-2.5 py-0.5 rounded-full">
                {product.categoria}
              </span>
              {product.linhagemCampea && <TricampeaoBadge />}
            </div>
            <h1 className="text-primary text-2xl sm:text-3xl font-bold leading-tight">
              {product.nome}
            </h1>
            {product.descricaoCurta && (
              <p className="text-muted-foreground text-sm">{product.descricaoCurta}</p>
            )}
          </div>

          {/* Compartilhar (só o link; prévia vem das OG da página) */}
          <ProductShare slug={product.slug} nome={product.nome} />

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

          {/* Composição (só peixe) — trio pré-selecionado */}
          {temVariantes && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-primary">Composição</span>
              <div className="flex flex-wrap gap-2">
                {ORDEM_COMPOSICAO.filter((c) =>
                  product.variantes.some((v) => v.composicao === c),
                ).map((c) => {
                  const v = product.variantes.find((x) => x.composicao === c)!;
                  const ativo = v.composicao === composicaoSel;
                  const zerado = !composicaoDisponivel(v, pool);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => escolherComposicao(c)}
                      disabled={zerado}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        ativo
                          ? "border-secondary bg-secondary/5"
                          : "border-border hover:border-primary"
                      } ${zerado ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <span className="block font-semibold text-primary">
                        {COMPOSICAO_LABEL[c]}
                        {v.rotulo ? ` · ${v.rotulo}` : ""}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {zerado ? "Sem estoque" : formatBRL(v.preco)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preço — cheio (cartão) bem legível; Pix em destaque como desconto */}
          <div className="space-y-1.5">
            {campanha && promo ? (
              <>
                {/* CAMPANHA (cupom) — prioridade total no bloco de preço */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-[11px] font-bold rounded-full px-2 py-0.5"
                    style={{ backgroundColor: "#FAB82A", color: "#07366A" }}
                  >
                    -{promo.descontoPercent}% OFF
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5"
                    style={{ backgroundColor: "#FAB82A", color: "#07366A" }}
                  >
                    <Tag size={12} className="shrink-0" aria-hidden="true" />
                    Cupom {campanha.codigo} aplicado
                  </span>
                </div>
                {/* "De" cheio riscado */}
                <p className="text-sm text-muted-foreground">
                  De{" "}
                  <span className="line-through">{formatBRL(precoCheio)}</span>
                </p>
                {/* "Por" promo Pix — grande, verde (destaque) */}
                <div className="flex items-end gap-2 flex-wrap">
                  <span className="text-green-600 text-3xl font-bold leading-none">
                    {formatBRL(promo.precoPromoPix)}
                  </span>
                  <span className="text-green-700 text-sm font-semibold pb-0.5">
                    {campanha.precoUnico ? "no Pix ou cartão" : "à vista no Pix"}
                  </span>
                </div>
                {campanha.precoUnico ? (
                  <p className="text-sm text-muted-foreground">
                    parcele no cartão
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {formatBRL(promo.precoPromoCheio)} no cartão, em parcelas
                  </p>
                )}
              </>
            ) : temDescontoPix ? (
              <>
                {/* Preço normal (cartão) — claro e legível, não escondido */}
                <p className="text-lg text-primary font-semibold leading-tight">
                  {formatBRL(precoCheio)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    no cartão, em parcelas
                  </span>
                </p>
                {/* Desconto Pix à vista — grande, em verde (destaque) */}
                <div className="flex items-end gap-2 flex-wrap">
                  <span className="text-green-600 text-3xl font-bold leading-none">
                    {formatBRL(precoPix)}
                  </span>
                  <span className="text-green-700 text-sm font-semibold pb-0.5">
                    à vista no Pix
                  </span>
                  <span className="text-[11px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                    {descontoPercent}% OFF
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-end gap-2 flex-wrap">
                  <span className="text-primary text-3xl font-bold leading-none">
                    {formatBRL(precoCheio)}
                  </span>
                  <span className="text-muted-foreground text-sm pb-0.5">
                    à vista
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  parcele no cartão
                </p>
              </>
            )}
          </div>

          {/* Selo de frete grátis (config da loja) */}
          {freteGratis.ativo && freteGratis.acimaDe != null && (
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              <Truck size={15} className="shrink-0" aria-hidden="true" />
              Frete grátis acima de {formatBRL(freteGratis.acimaDe)}
            </p>
          )}

          {/* Frete — logo abaixo do preço */}
          <div className="max-w-md">
            <ProductFreteEstimator qtd={qtdPeixesUnit * qtd} />
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
                    onClick={() => setQtd((q) => Math.min(estoqueAtual, q + 1))}
                    disabled={qtd >= estoqueAtual}
                    aria-label="Aumentar quantidade"
                    className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {/* PRIMÁRIO — ação dominante (rosa da marca, maior, com sombra) */}
                <button
                  type="button"
                  onClick={handleComprar}
                  className="w-full bg-secondary text-white text-base font-bold py-3.5 rounded-pill shadow-[0_8px_24px_-8px_rgba(255,3,92,0.5)] hover:brightness-110 transition-all"
                >
                  Comprar agora
                </button>
                {/* SECUNDÁRIO — adicionar ao carrinho (outline, menos peso) */}
                <button
                  type="button"
                  onClick={adicionar}
                  className="w-full flex items-center justify-center gap-2 border-2 border-secondary text-secondary font-semibold py-3 rounded-pill hover:bg-secondary/5 transition-all"
                >
                  <ShoppingCart size={17} aria-hidden="true" />
                  Adicionar ao carrinho
                </button>
                {/* TERCIÁRIO — suporte, discreto (link com alvo de 44px) */}
                <a
                  href={duvidasHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 min-h-11 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                  Tirar dúvidas no WhatsApp
                </a>
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

      {/* ═══ Blocos institucionais — padrão: título no topo, imagem à esquerda
          + texto à direita, link ao final; separadores entre colunas ═══ */}
      <section className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
        {INSTITUCIONAIS.map((b) => {
          const externo = b.link?.href.startsWith("http");
          // Selo é emblema — bloco "Garantia" tem layout próprio (card centralizado).
          const isSelo = b.imagem.includes("selo");
          const linkClass =
            "inline-flex items-center gap-1 min-h-11 text-sm font-semibold text-secondary hover:underline";
          const linkEl = b.link
            ? externo
              ? (
                <a
                  href={b.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${linkClass} mt-2`}
                >
                  {b.link.label} →
                </a>
              )
              : (
                <Link href={b.link.href} className={`${linkClass} mt-2`}>
                  {b.link.label} →
                </Link>
              )
            : null;

          // ═══ "Garantia de chegada viva": card com moldura, tudo centralizado
          //     (título topo → selo no centro → texto → link no rodapé) ═══
          if (isSelo) {
            return (
              <div
                key={b.titulo}
                className="py-5 md:py-0 md:px-6 md:first:pl-0 md:last:pr-0"
              >
                <div className="flex h-full flex-col items-center rounded-xl border border-border p-5 text-center">
                  <h3 className="font-semibold text-primary text-base mb-3">
                    {b.titulo}
                  </h3>
                  {/* Selo inteiro (object-contain, sem corte) */}
                  <div className="relative w-32 aspect-square mb-3">
                    <Image
                      src={b.imagem}
                      alt={b.titulo}
                      fill
                      sizes="128px"
                      className="object-contain"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {b.texto}
                  </p>
                  {linkEl}
                </div>
              </div>
            );
          }

          return (
            <div
              key={b.titulo}
              className="py-5 md:py-0 md:px-6 md:first:pl-0 md:last:pr-0"
            >
              {/* Título no topo, largura total do bloco */}
              <h3 className="font-semibold text-primary text-base mb-3">
                {b.titulo}
              </h3>

              {/* Imagem à esquerda + texto à direita */}
              <div className="flex gap-3 items-start">
                <div className="relative w-2/5 shrink-0 aspect-[5/8] rounded-lg overflow-hidden">
                  <Image
                    src={b.imagem}
                    alt={b.titulo}
                    fill
                    sizes="(max-width: 768px) 40vw, 15vw"
                    className="object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {b.texto}
                  </p>

                  {b.checks && (
                    <ul className="space-y-1.5">
                      {b.checks.map((c) => (
                        <li
                          key={c}
                          className="flex items-center gap-2 text-sm text-primary"
                        >
                          <Check
                            size={16}
                            className="text-green-600 shrink-0"
                            aria-hidden="true"
                          />
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Link de ação ao final do bloco */}
              {linkEl}
            </div>
          );
        })}
      </section>

      {/* ═══ Outros peixes da loja ═══
          Título antigo era "Quem viu este peixe também viu", o que afirmava um
          comportamento de visitante que ninguém media: a lista é a mesma
          categoria, mais recentes primeiro.
          O preço sai do ProductCardSimple, o MESMO card da /loja. A marcação
          escrita à mão que existia aqui só olhava precoPix e mostrava o preço
          cheio de peixe em promoção. */}
      {relacionados.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-primary text-lg font-semibold">
            Outros peixes da loja
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {relacionados.map((r) => (
              <div key={r.id} className="shrink-0 w-44 sm:w-52">
                <ProductCardSimple product={r} />
              </div>
            ))}
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
            src="/images/selo.webp"
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
