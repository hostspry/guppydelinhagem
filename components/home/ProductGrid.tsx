import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import SectionHeader from "@/components/home/SectionHeader";
import type { ProductMock } from "@/lib/mock-data";

type Props = {
  title: string;
  highlight: string;
  products: ProductMock[];
  verTudoHref: string;
};

export default function ProductGrid({ title, highlight, products, verTudoHref }: Props) {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <SectionHeader title={title} highlight={highlight} />
        <Link
          href={verTudoHref}
          className="shrink-0 bg-secondary text-white text-sm font-semibold px-5 py-2.5 rounded-pill hover:brightness-110 transition-all"
        >
          Ver Tudo
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
