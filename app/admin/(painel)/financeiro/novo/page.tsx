import { PageHeader } from "@/components/admin/PageHeader";
import { LancamentoForm } from "@/components/admin/financeiro/LancamentoForm";
import { categoriasParaFormulario } from "@/lib/queries/financeiro";
import { paraInputDate } from "@/lib/financeiro/periodo";

export default async function NovoLancamentoPage() {
  const categorias = await categoriasParaFormulario();

  return (
    <div>
      <PageHeader
        title="Novo lançamento"
        description="Digite os dados ou deixe a IA ler o comprovante para você."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Financeiro", href: "/admin/financeiro" },
          { label: "Novo" },
        ]}
      />
      <LancamentoForm categorias={categorias} hoje={paraInputDate(new Date())} />
    </div>
  );
}
