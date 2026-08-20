import { PageHeader } from "@/components/admin/PageHeader";
import { LancamentoForm } from "@/components/admin/financeiro/LancamentoForm";
import {
  categoriasParaFormulario,
  campanhasUsadas,
} from "@/lib/queries/financeiro";
import { paraInputDate } from "@/lib/financeiro/periodo";

export default async function NovoLancamentoPage() {
  const [categorias, campanhas] = await Promise.all([
    categoriasParaFormulario(),
    campanhasUsadas(),
  ]);

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
      <LancamentoForm
        categorias={categorias}
        campanhas={campanhas}
        hoje={paraInputDate(new Date())}
      />
    </div>
  );
}
