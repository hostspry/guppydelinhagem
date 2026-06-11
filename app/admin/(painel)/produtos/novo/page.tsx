import { PageHeader } from "@/components/admin/PageHeader";
import { ProductForm } from "@/components/admin/ProductForm";
import { getProductFormData } from "@/lib/queries/products";

export default async function NovoProdutoPage() {
  const { categorias } = await getProductFormData();

  return (
    <div>
      <PageHeader
        title="Novo produto"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Produtos", href: "/admin/produtos" },
          { label: "Novo" },
        ]}
      />
      <ProductForm categorias={categorias} />
    </div>
  );
}
