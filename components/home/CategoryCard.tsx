import Image from "next/image";
import Link from "next/link";
import type { HomeCategory } from "@/lib/home-content";

export default function CategoryCard({ category }: { category: HomeCategory }) {
  return (
    <Link
      href={category.href}
      className="group relative block rounded-[20px] overflow-hidden h-[400px] md:h-[500px]"
    >
      <Image
        src={category.imagem}
        alt={category.nome}
        fill
        className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      {/* Overlay gradiente bottom-to-top */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.30) 50%, transparent 100%)",
        }}
      />

      {/* Conteúdo sobreposto */}
      <div className="absolute bottom-0 left-0 right-0 p-6 space-y-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
        <h3 className="text-white text-2xl font-semibold">{category.nome}</h3>
        <p className="text-white/90 text-sm font-light leading-relaxed">{category.descricao}</p>
        <span className="inline-block text-accent font-semibold text-sm mt-1 group-hover:translate-x-1 transition-transform duration-200">
          Ver Categoria →
        </span>
      </div>
    </Link>
  );
}
