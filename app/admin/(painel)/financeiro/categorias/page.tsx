import { PageHeader } from "@/components/admin/PageHeader";
import { CategoriasAdmin } from "@/components/admin/financeiro/CategoriasAdmin";
import { listarCategorias } from "@/lib/queries/financeiro";

export default async function CategoriasFinanceirasPage() {
  const categorias = await listarCategorias();

  return (
    <div>
      <PageHeader
        title="Categorias do caixa"
        description="Como as entradas e saídas são agrupadas no relatório do mês."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Financeiro", href: "/admin/financeiro" },
          { label: "Categorias" },
        ]}
      />
      <CategoriasAdmin categorias={categorias} />
    </div>
  );
}
