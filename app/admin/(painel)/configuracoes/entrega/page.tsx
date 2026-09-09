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
        taxaEmbalagemSeco: config.taxaEmbalagemSeco,
        remetenteNome: config.remetenteNome,
        remetenteDocumento: config.remetenteDocumento,
        remetenteEmail: config.remetenteEmail,
        remetenteTelefone: config.remetenteTelefone,
        remetenteCep: config.remetenteCep,
        remetenteLogradouro: config.remetenteLogradouro,
        remetenteNumero: config.remetenteNumero,
        remetenteComplemento: config.remetenteComplemento,
        remetenteBairro: config.remetenteBairro,
        remetenteCidade: config.remetenteCidade,
        remetenteUf: config.remetenteUf,
        retiradaLocalAtiva: config.retiradaLocalAtiva,
        retiradaInstrucoes: config.retiradaInstrucoes,
      }}
    />
  );
}
