import { PageHeader } from "@/components/admin/PageHeader";
import { LeilaoForm } from "@/components/admin/leiloes/LeilaoForm";

export default function NovoLeilaoPage() {
  return (
    <div>
      <PageHeader
        title="Novo leilão"
        description="Depois de criar, você lança os lotes e gera as cobranças dos arrematantes."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Leilões", href: "/admin/leiloes" },
          { label: "Novo" },
        ]}
      />
      <LeilaoForm />
    </div>
  );
}
