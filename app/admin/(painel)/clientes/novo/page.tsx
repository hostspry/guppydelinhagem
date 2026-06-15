import { PageHeader } from "@/components/admin/PageHeader";
import { ClienteForm } from "@/components/admin/ClienteForm";

export default function NovoClientePage() {
  return (
    <div>
      <PageHeader
        title="Novo cliente"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Clientes", href: "/admin/clientes" },
          { label: "Novo" },
        ]}
      />
      <ClienteForm />
    </div>
  );
}
