import { PageHeader } from "@/components/admin/PageHeader";
import { ConfigTabs } from "@/components/admin/ConfigTabs";
import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

/**
 * Configurações em abas por assunto. O cabeçalho e a navegação ficam aqui para
 * não repetir em cada aba — e para a troca de aba não redesenhar o topo.
 */
export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("config.editar");

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Ajustes globais da loja, separados por assunto."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Configurações" },
        ]}
      />
      <ConfigTabs />
      {children}
    </div>
  );
}
