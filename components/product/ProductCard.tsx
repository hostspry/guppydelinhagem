import Link from "next/link";
import { CalendarDays, Check, Play } from "lucide-react";
import { VideoThumb } from "@/components/admin/VideoThumb";
import { formatBRL } from "@/lib/utils/format";
import type { PublicProductCard } from "@/lib/queries/products";

const PLATFORM_LABEL: Record<NonNullable<PublicProductCard["video"]>["platform"], string> = {
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
};

const PLATFORM_COLOR: Record<NonNullable<PublicProductCard["video"]>["platform"], string> = {
  YOUTUBE: "bg-red-600",
  INSTAGRAM: "bg-pink-600",
  TIKTOK: "bg-gray-900",
};

export default function ProductCard({ product }: { product: PublicProductCard }) {
  const semEstoque = product.estoque <= 0;
  const temDescontoPix =
    product.descontoPix != null && product.descontoPix > 0;
  const precoPix = temDescontoPix
    ? product.preco * (1 - product.descontoPix! / 100)
    : product.preco;
  const valorParcela = product.preco / product.parcelasMax;

  return (
    <Link href={`/loja/${product.slug}`} className="block group">
      <div className="relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-border">
        {/* Vídeo principal 9:16 — facade: só a capa, sem iframe na listagem */}
        <div className="relative aspect-[9/16] overflow-hidden bg-muted">
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

          {/* Badge da plataforma */}
          {product.video && (
            <span
              className={`absolute top-2 left-2 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full ${PLATFORM_COLOR[product.video.platform]}`}
            >
              {PLATFORM_LABEL[product.video.platform]}
            </span>
          )}

          {/* Play (facade) */}
          {product.video?.thumbnailUrl && !semEstoque && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="bg-black/45 rounded-full p-3 group-hover:bg-black/60 transition-colors">
                <Play className="w-6 h-6 text-white fill-white" aria-hidden="true" />
              </span>
            </div>
          )}

          {/* Sem estoque */}
          {semEstoque && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white text-primary text-xs font-semibold px-3 py-1 rounded-full">
                Sem estoque
              </span>
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div className="p-4 space-y-2">
          <p className="text-primary font-semibold text-sm leading-tight line-clamp-2">
            {product.nome}
          </p>

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

          {/* Preço cheio riscado (só quando há desconto Pix) */}
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
        </div>
      </div>
    </Link>
  );
}
