import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { CupomForm } from "@/components/admin/CupomForm";
import { getCupomById, getCupomFormData } from "@/lib/queries/cupons";

type Props = { params: Promise<{ id: string }> };

export default async function EditarCupomPage({ params }: Props) {
  const { id } = await params;
  const [cupom, formData] = await Promise.all([
    getCupomById(id),
    getCupomFormData(),
  ]);

  if (!cupom) notFound();

  return (
    <div>
      <PageHeader
        title="Editar cupom"
        description={cupom.codigo}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Cupons", href: "/admin/cupons" },
          { label: cupom.codigo },
        ]}
      />
      <CupomForm
        initialData={cupom}
        categorias={formData.categorias}
        produtos={formData.produtos}
      />
    </div>
  );
}
