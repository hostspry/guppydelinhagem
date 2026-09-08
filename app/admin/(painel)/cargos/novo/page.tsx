import { PageHeader } from "@/components/admin/PageHeader";
import { CargoForm } from "@/components/admin/CargoForm";

export default function NovoCargoPage() {
  return (
    <div>
      <PageHeader
        title="Novo cargo"
        description="Marque o que este cargo pode fazer e qual caixa ele enxerga."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Cargos", href: "/admin/cargos" },
          { label: "Novo" },
        ]}
      />
      <CargoForm />
    </div>
  );
}
