import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { HeroSlideForm } from "@/components/admin/HeroSlideForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditarHeroSlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await prisma.heroSlide.findUnique({ where: { id } });
  if (!s) notFound();

  return (
    <div>
      <PageHeader
        title="Editar slide"
        description={s.titleLine1}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Hero da home", href: "/admin/hero-slides" },
          { label: "Editar" },
        ]}
      />
      <HeroSlideForm
        inicial={{
          id: s.id,
          active: s.active,
          order: s.order,
          eyebrowText: s.eyebrowText ?? "",
          eyebrowIcon: s.eyebrowIcon ?? "",
          titleLine1: s.titleLine1,
          titleLine2: s.titleLine2 ?? "",
          subtitle: s.subtitle ?? "",
          fishImageUrl: s.fishImageUrl,
          fishImageAlt: s.fishImageAlt,
          backgroundUrl: s.backgroundUrl ?? "",
          badgeText: s.badgeText ?? "",
          badgeYear: s.badgeYear ?? "",
          badgeIcon: s.badgeIcon ?? "",
          primaryCtaText: s.primaryCtaText,
          primaryCtaUrl: s.primaryCtaUrl,
          secondaryCtaText: s.secondaryCtaText ?? "",
          secondaryCtaUrl: s.secondaryCtaUrl ?? "",
        }}
      />
    </div>
  );
}
