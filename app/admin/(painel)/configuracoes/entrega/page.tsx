import { ConfigEntregaForm } from "@/components/admin/ConfigEntregaForm";
import { SaldoMelhorEnvio } from "@/components/admin/SaldoMelhorEnvio";
import { getConfiguracaoLoja } from "@/lib/queries/config";
import { consultarSaldo } from "@/lib/melhorenvio";
import { podeAtual } from "@/lib/permissoes-server";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesEntregaPage() {
  // O saldo é lido junto com a página: quem abre "Entrega" quase sempre está
  // indo despachar, e descobrir a carteira vazia aqui é melhor do que descobrir
  // no meio da compra da etiqueta. Erro de leitura não derruba a tela.
  const [config, saldo, podeRecarregar] = await Promise.all([
    getConfiguracaoLoja(),
    consultarSaldo(),
    podeAtual("financeiro.gerenciar"),
  ]);

  return (
    <>
      <div className="mb-5">
        <SaldoMelhorEnvio
          inicial={saldo.ok ? saldo.data : null}
          erroInicial={saldo.ok ? null : saldo.error}
          podeRecarregar={podeRecarregar}
        />
      </div>

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
    </>
  );
}
