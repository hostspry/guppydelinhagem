import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { HeroSlideAcoes } from "@/components/admin/HeroSlideAcoes";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HeroSlidesPage() {
  const slides = await prisma.heroSlide.findMany({ orderBy: { order: "asc" } });

  return (
    <div>
      <PageHeader
        title="Hero da home"
        description="Os banners do topo do site. A ordem aqui é a ordem que o cliente vê."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Hero da home" }]}
        action={
          <Link
            href="/admin/hero-slides/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo slide
          </Link>
        }
      />

      <div className="space-y-3 max-w-3xl">
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-start gap-4 bg-white border rounded-lg p-4 ${
              s.active ? "border-gray-200" : "border-gray-200 opacity-60"
            }`}
          >
            <div className="relative w-20 h-20 shrink-0 rounded-md border border-gray-100 bg-gray-50 overflow-hidden">
              {s.fishImageUrl && (
                <Image
                  src={s.fishImageUrl}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-contain"
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {s.eyebrowText && (
                <p className="text-[10px] uppercase tracking-wide text-gray-400">
                  {s.eyebrowText}
                </p>
              )}
              <Link
                href={`/admin/hero-slides/${s.id}/editar`}
                className="text-sm font-semibold text-[#07366A] hover:underline"
              >
                {s.titleLine1} {s.titleLine2}
              </Link>
              {s.subtitle && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                  {s.subtitle}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-1">
                Botão: {s.primaryCtaText} → {s.primaryCtaUrl}
              </p>
              {!s.active && (
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  não aparece no site
                </span>
              )}
            </div>

            <HeroSlideAcoes
              id={s.id}
              ativo={s.active}
              titulo={s.titleLine1}
              primeiro={i === 0}
              ultimo={i === slides.length - 1}
            />
          </div>
        ))}

        {slides.length === 0 && (
          <p className="text-sm text-gray-500">
            Nenhum slide ainda. Crie o primeiro para o topo da home.
          </p>
        )}
      </div>
    </div>
  );
}
