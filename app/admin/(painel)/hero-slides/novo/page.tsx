import { PageHeader } from "@/components/admin/PageHeader";
import { HeroSlideForm } from "@/components/admin/HeroSlideForm";

export default function NovoHeroSlidePage() {
  return (
    <div>
      <PageHeader
        title="Novo slide"
        description="Um banner novo para o topo da home."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Hero da home", href: "/admin/hero-slides" },
          { label: "Novo" },
        ]}
      />
      <HeroSlideForm
        inicial={{
          active: true,
          order: 0,
          eyebrowText: "",
          eyebrowIcon: "",
          titleLine1: "",
          titleLine2: "",
          subtitle: "",
          fishImageUrl: "",
          fishImageAlt: "",
          backgroundUrl: "",
          badgeText: "",
          badgeYear: "",
          badgeIcon: "",
          primaryCtaText: "Comprar agora",
          primaryCtaUrl: "/loja",
          secondaryCtaText: "",
          secondaryCtaUrl: "",
        }}
      />
    </div>
  );
}
