import { PageHeader } from "@/components/admin/PageHeader";
import { MembroForm } from "@/components/admin/MembroForm";
import { cargosParaFormulario } from "@/lib/queries/cargos";

export default async function NovoMembroPage() {
  const cargos = await cargosParaFormulario();

  return (
    <div>
      <PageHeader
        title="Novo membro"
        description="A senha temporária aparece na tela depois de salvar."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Equipe", href: "/admin/equipe" },
          { label: "Novo" },
        ]}
      />
      <MembroForm cargos={cargos} />
    </div>
  );
}
