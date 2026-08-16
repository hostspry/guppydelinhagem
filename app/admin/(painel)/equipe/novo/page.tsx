import { PageHeader } from "@/components/admin/PageHeader";
import { MembroForm } from "@/components/admin/MembroForm";

export default function NovoMembroPage() {
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
      <MembroForm />
    </div>
  );
}
