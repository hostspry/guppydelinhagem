import { ConfigPagamentosForm } from "@/components/admin/ConfigPagamentosForm";
import { getConfiguracaoLoja } from "@/lib/queries/config";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPagamentosPage() {
  const config = await getConfiguracaoLoja();

  return (
    <ConfigPagamentosForm
      inicial={{
        descontoPixGlobalPercent: config.descontoPixGlobalPercent,
        pagbankAtivo: config.pagbankAtivo,
      }}
    />
  );
}
