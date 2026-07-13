import Link from "next/link";
import { Check, Tag } from "lucide-react";
import { VideoThumb } from "@/components/admin/VideoThumb";
import FeedPlayButton from "@/components/feed/FeedPlayButton";
import { TricampeaoBadge } from "@/components/site/TricampeaoBadge";
import { formatBRL } from "@/lib/utils/format";
import type { PublicProductCard } from "@/lib/queries/products";

const PLATFORM_LABEL = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
} as const;

const PLATFORM_COLOR = {
  YOUTUBE: "bg-red-600",
  INSTAGRAM: "bg-pink-600",
  TIKTOK: "bg-gray-900",
} as const;

/**
 * Card enxuto da listagem /loja: thumbnail (facade — sem iframe na grade),
 * nome, preço Pix em destaque. O card inteiro navega para a página de produto;
 * a decisão de quantidade/carrinho acontece lá, não aqui.
 */
export default function ProductCardSimple({
  product,
}: {
  product: PublicProductCard;
}) {
  const semEstoque = product.estoque <= 0;
  // Preços já vêm calculados do servidor (lib/precos + desconto global) — o card
  // NÃO recalcula, batendo com a página do produto.
  const temDescontoPix = product.descontoPixPercent > 0;
  // Campanha (cupom) tem PRIORIDADE sobre os ramos de preço normais.
  const campanha = product.campanha;

  return (
    <Link
      href={`/loja/${product.slug}`}
      className="group flex flex-col bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-border"
    >
      {/* Capa 9:16 — só thumbnail (leve e escaneável) */}
      <div className="relative aspect-[9/16] overflow-hidden bg-muted">
        {product.video?.thumbnailUrl ? (
          <VideoThumb
            src={product.video.thumbnailUrl}
            alt={product.nome}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            sem mídia
          </div>
        )}

        {product.video && (
          <span
            className={`absolute top-2 right-2 z-10 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full ${PLATFORM_COLOR[product.video.platform]}`}
          >
            {PLATFORM_LABEL[product.video.platform]}
          </span>
        )}

        {product.linhagemCampea && (
          <div className="absolute top-2 left-2 z-20">
            <TricampeaoBadge size="sm" short />
          </div>
        )}

        {/* Mobile: tocar no vídeo abre o feed neste produto (desktop: card normal) */}
        {product.video && <FeedPlayButton slug={product.slug} />}

        {semEstoque && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white text-primary text-xs font-semibold px-3 py-1 rounded-full">
              Sem estoque
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="text-primary font-semibold text-sm leading-tight line-clamp-2 group-hover:text-accent transition-colors">
          {product.nome}
        </p>

        <div className="mt-auto">
          {campanha ? (
            <>
              {/* CAMPANHA (cupom) — prioridade: "De" riscado + "Por" em destaque */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-[11px] font-bold rounded-full px-2 py-0.5"
                  style={{ backgroundColor: "#FAB82A", color: "#07366A" }}
                >
                  -{campanha.descontoPercent}% OFF
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5"
                  style={{ backgroundColor: "#FAB82A", color: "#07366A" }}
                >
                  <Tag size={11} className="shrink-0" aria-hidden="true" />
                  Cupom {campanha.codigo}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                De{" "}
                <span className="line-through">
                  {formatBRL(product.precoCheio)}
                </span>
              </p>
              <p className="text-green-600 text-xl font-bold leading-none mt-0.5">
                Por {formatBRL(campanha.precoPromoPix)}
              </p>
              {campanha.precoUnico ? (
                <p className="text-xs text-green-700 font-medium mt-1">
                  no Pix ou cartão
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="line-through">
                    {formatBRL(campanha.precoPromoCheio)}
                  </span>{" "}
                  no cartão
                </p>
              )}
            </>
          ) : temDescontoPix ? (
            <>
              {/* COM desconto: Pix em destaque + cartão riscado + % OFF */}
              <p className="text-green-600 text-xl font-bold leading-none">
                {formatBRL(product.precoPix)}
              </p>
              <p className="flex items-center gap-1 text-green-700 text-xs font-medium mt-1">
                <Check size={13} className="shrink-0" aria-hidden="true" />
                no Pix · {product.descontoPixPercent}% OFF
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="line-through">{formatBRL(product.precoCheio)}</span>{" "}
                no cartão
              </p>
            </>
          ) : (
            <>
              {/* SEM desconto: preço único, sem insinuar vantagem no Pix */}
              <p className="text-green-600 text-xl font-bold leading-none">
                {formatBRL(product.precoCheio)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                à vista · parcele no cartão
              </p>
            </>
          )}
        </div>

        <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-secondary group-hover:underline">
          Ver produto →
        </span>
      </div>
    </Link>
  );
}
