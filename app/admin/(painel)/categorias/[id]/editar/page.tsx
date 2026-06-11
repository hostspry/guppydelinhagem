import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { CategoryForm } from "@/components/admin/CategoryForm";
import { getCategoryById } from "@/lib/queries/categories";

type Props = { params: Promise<{ id: string }> };

export default async function EditarCategoriaPage({ params }: Props) {
  const { id } = await params;
  const cat = await getCategoryById(id);

  if (!cat) notFound();

  return (
    <div>
      <PageHeader
        title="Editar categoria"
        description={cat.nome}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Categorias", href: "/admin/categorias" },
          { label: cat.nome },
        ]}
      />
      <CategoryForm
        initialData={{
          id: cat.id,
          nome: cat.nome,
          slug: cat.slug,
          ordem: cat.ordem,
        }}
      />
    </div>
  );
}
