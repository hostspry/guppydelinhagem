import { ConfigEntregaForm } from "@/components/admin/ConfigEntregaForm";
import { getConfiguracaoLoja } from "@/lib/queries/config";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesEntregaPage() {
  const config = await getConfiguracaoLoja();

  return (
    <ConfigEntregaForm
      inicial={{
        freteGratisAtivo: config.freteGratisAtivo,
        freteGratisAcimaDe: config.freteGratisAcimaDe,
        maxPeixesFreteAuto: config.maxPeixesFreteAuto,
        retiradaLocalAtiva: config.retiradaLocalAtiva,
        retiradaInstrucoes: config.retiradaInstrucoes,
      }}
    />
  );
}
