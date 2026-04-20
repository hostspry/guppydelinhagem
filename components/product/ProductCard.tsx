import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check } from "lucide-react";
import type { ProductMock } from "@/lib/mock-data";

export default function ProductCard({ product }: { product: ProductMock }) {
  const card = (
    <div className="relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-border group">
      {/* Imagem */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        <Image
          src={product.imagem}
          alt={product.nome}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
        />
        {!product.emEstoque && (
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
        <p className="text-primary text-xl font-bold">
          R$ {product.preco.toFixed(2).replace(".", ",")}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground font-light">
          <CalendarDays size={12} className="shrink-0" />
          Em até {product.parcelas}x de R$ {product.valorParcela.toFixed(2).replace(".", ",")} sem juros
        </p>
      </div>

      {/* Faixa Pix */}
      <div className="bg-green-50 px-4 py-2 flex items-center gap-1.5">
        <Check size={13} className="text-green-700 shrink-0" />
        <span className="text-green-700 text-xs font-medium">
          À vista R$ {product.precoPix.toFixed(2).replace(".", ",")} no Pix
        </span>
      </div>
    </div>
  );

  if (!product.emEstoque) return card;

  return (
    <Link href={`/loja/${product.slug}`} className="block">
      {card}
    </Link>
  );
}
