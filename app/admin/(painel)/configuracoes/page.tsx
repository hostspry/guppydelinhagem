import { PageHeader } from "@/components/admin/PageHeader";
import { ConfiguracoesForm } from "@/components/admin/ConfiguracoesForm";
import { getConfiguracaoLoja } from "@/lib/queries/config";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const config = await getConfiguracaoLoja();

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Configurações globais da loja."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Configurações" },
        ]}
      />
      <ConfiguracoesForm inicial={config} />
    </div>
  );
}
