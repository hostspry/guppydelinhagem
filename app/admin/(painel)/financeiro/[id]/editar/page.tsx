import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { LancamentoForm } from "@/components/admin/financeiro/LancamentoForm";
import {
  categoriasParaFormulario,
  campanhasUsadas,
  getLancamento,
} from "@/lib/queries/financeiro";
import { paraInputDate } from "@/lib/financeiro/periodo";

export default async function EditarLancamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lancamento, categorias, campanhas] = await Promise.all([
    getLancamento(id),
    categoriasParaFormulario(),
    campanhasUsadas(),
  ]);
  if (!lancamento) notFound();

  return (
    <div>
      <PageHeader
        title="Editar lançamento"
        description={lancamento.descricao}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Financeiro", href: "/admin/financeiro" },
          { label: "Editar" },
        ]}
      />
      <LancamentoForm
        categorias={categorias}
        campanhas={campanhas}
        hoje={paraInputDate(new Date())}
        initialData={{
          id: lancamento.id,
          tipo: lancamento.tipo,
          descricao: lancamento.descricao,
          valor: lancamento.valor,
          data: paraInputDate(lancamento.data),
          categoriaId: lancamento.categoriaId,
          observacoes: lancamento.observacoes,
          comprovanteUrl: lancamento.comprovanteUrl,
          vencimento: lancamento.vencimento
            ? paraInputDate(lancamento.vencimento)
            : null,
          pendente: lancamento.status === "PENDENTE",
          canal: lancamento.canal,
          campanha: lancamento.campanha,
        }}
      />
    </div>
  );
}
