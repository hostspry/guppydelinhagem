import { PageHeader } from "@/components/admin/PageHeader";
import { RecorrentesAdmin } from "@/components/admin/financeiro/RecorrentesAdmin";
import {
  categoriasParaFormulario,
  listarRecorrencias,
} from "@/lib/queries/financeiro";
import { competenciaAtual } from "@/lib/financeiro/periodo";

export default async function RecorrentesPage() {
  const [recorrencias, categorias] = await Promise.all([
    listarRecorrencias(),
    categoriasParaFormulario(),
  ]);

  return (
    <div>
      <PageHeader
        title="Contas fixas"
        description="O que se repete todo mês: luz, água, internet, ração."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Financeiro", href: "/admin/financeiro" },
          { label: "Contas fixas" },
        ]}
      />
      <RecorrentesAdmin
        recorrencias={recorrencias}
        categorias={categorias}
        competencia={competenciaAtual()}
      />
    </div>
  );
}
