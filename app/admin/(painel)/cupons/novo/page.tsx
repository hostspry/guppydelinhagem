import { PageHeader } from "@/components/admin/PageHeader";
import { CupomForm } from "@/components/admin/CupomForm";
import { getCupomFormData } from "@/lib/queries/cupons";

export default async function NovoCupomPage() {
  const { categorias, produtos } = await getCupomFormData();

  return (
    <div>
      <PageHeader
        title="Novo cupom"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Cupons", href: "/admin/cupons" },
          { label: "Novo" },
        ]}
      />
      <CupomForm categorias={categorias} produtos={produtos} />
    </div>
  );
}
