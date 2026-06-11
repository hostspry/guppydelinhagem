import { PageHeader } from "@/components/admin/PageHeader";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { getNextOrdem } from "@/lib/queries/categories";

export default async function NovaCategoriaPage() {
  const nextOrdem = await getNextOrdem();

  return (
    <div>
      <PageHeader
        title="Nova categoria"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Categorias", href: "/admin/categorias" },
          { label: "Nova" },
        ]}
      />
      <CategoryForm defaultOrdem={nextOrdem} />
    </div>
  );
}
