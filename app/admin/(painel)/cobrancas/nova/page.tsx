import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/PageHeader";
import { CobrancaForm } from "@/components/admin/CobrancaForm";

export const dynamic = "force-dynamic";

export default async function NovaCobrancaPage() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  return (
    <div>
      <PageHeader
        title="Nova cobrança"
        description="Descreva o que está cobrando, informe o valor e gere o link."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Cobranças", href: "/admin/cobrancas" },
          { label: "Nova" },
        ]}
      />
      <CobrancaForm clientes={clientes} />
    </div>
  );
}
