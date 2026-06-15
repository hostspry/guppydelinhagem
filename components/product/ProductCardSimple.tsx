import Link from "next/link";
import { Check } from "lucide-react";
import { VideoThumb } from "@/components/admin/VideoThumb";
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
  const temDescontoPix =
    product.descontoPix != null && product.descontoPix > 0;
  const precoPix = temDescontoPix
    ? product.preco * (1 - product.descontoPix! / 100)
    : product.preco;

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
            className={`absolute top-2 left-2 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full ${PLATFORM_COLOR[product.video.platform]}`}
          >
            {PLATFORM_LABEL[product.video.platform]}
          </span>
        )}

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
          <p className="text-green-600 text-xl font-bold leading-none">
            {formatBRL(precoPix)}
          </p>
          <p className="flex items-center gap-1 text-green-700 text-xs font-medium mt-1">
            <Check size={13} className="shrink-0" aria-hidden="true" />
            à vista no Pix
          </p>
          {temDescontoPix && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className="line-through">{formatBRL(product.preco)}</span> no
              cartão
            </p>
          )}
        </div>

        <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-secondary group-hover:underline">
          Ver produto →
        </span>
      </div>
    </Link>
  );
}
