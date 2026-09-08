import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { CargoForm } from "@/components/admin/CargoForm";
import { getCargo } from "@/lib/queries/cargos";

export default async function EditarCargoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cargo = await getCargo(id);
  if (!cargo) notFound();

  return (
    <div>
      <PageHeader
        title={cargo.nome}
        description={cargo.descricao ?? "Editar as permissões deste cargo."}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Cargos", href: "/admin/cargos" },
          { label: "Editar" },
        ]}
      />
      <CargoForm
        initialData={{
          id: cargo.id,
          nome: cargo.nome,
          descricao: cargo.descricao,
          permissoes: cargo.permissoes,
          segmentosFinanceiros: cargo.segmentosFinanceiros,
          protegido: cargo.protegido,
          pessoas: cargo.pessoas,
        }}
      />
    </div>
  );
}
