"use client";

import { RAMPA_FUNIL, CHROME } from "./paleta";

export type EtapaFunil = { chave: string; rotulo: string; pessoas: number };

/**
 * Funil de compra, em pessoas.
 *
 * Barras horizontais em rampa de um tom só, do claro ao escuro: as etapas têm
 * ordem, e cor por ordem mostra isso sem precisar de legenda. Cada barra leva o
 * número na ponta e a porcentagem de quem sobreviveu do passo anterior — que é
 * o número que aponta onde a loja perde gente.
 */
export function Funil({
  etapas,
  pedidosPagos,
}: {
  etapas: EtapaFunil[];
  /** Pedidos do site realmente pagos na janela. Ver a nota abaixo. */
  pedidosPagos: number;
}) {
  const topo = etapas[0]?.pessoas ?? 0;
  const fechou = etapas.at(-1)?.pessoas ?? 0;

  if (topo === 0) {
    return (
      <p className="text-sm text-gray-500">
        Ninguém entrou no site nesse período.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {etapas.map((e, i) => {
        const anterior = i === 0 ? null : etapas[i - 1].pessoas;
        const doTotal = Math.round((e.pessoas / topo) * 100);
        const doAnterior =
          anterior && anterior > 0 ? Math.round((e.pessoas / anterior) * 100) : null;
        // Barra proporcional ao topo do funil, nunca ao maior valor da lista:
        // o funil só faz sentido se cada etapa for lida contra quem entrou.
        const largura = Math.max(topo > 0 ? (e.pessoas / topo) * 100 : 0, e.pessoas > 0 ? 1.5 : 0);

        return (
          <div key={e.chave}>
            {/* No celular o rótulo e as porcentagens ficam em linhas separadas.
                Lado a lado, a porcentagem comia a largura e "Olhou um peixe"
                quebrava em três linhas, uma palavra em cada. */}
            <div className="mb-1 sm:flex sm:items-baseline sm:justify-between sm:gap-3">
              <span className="block text-xs font-medium text-gray-600">{e.rotulo}</span>
              <span className="block text-xs text-gray-400 sm:whitespace-nowrap">
                {doAnterior !== null && (
                  <>
                    <strong className="font-medium text-gray-500">{doAnterior}%</strong>
                    <span> do passo anterior · </span>
                  </>
                )}
                {doTotal}% de quem entrou
              </span>
            </div>
            {/* O número tem coluna própria, de largura fixa. Quando ele dividia
                espaço com a barra, a primeira etapa (que é sempre 100%) empurrava
                o valor para fora do cartão e ele saía cortado — "1." no lugar de
                1.371. Rótulo cortado é pior que rótulo nenhum. */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div
                  className="h-5 rounded-r-[4px]"
                  style={{
                    width: `${largura}%`,
                    backgroundColor: RAMPA_FUNIL[Math.min(i, RAMPA_FUNIL.length - 1)],
                  }}
                />
              </div>
              <span
                className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums"
                style={{ color: CHROME.texto }}
              >
                {e.pessoas.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        );
      })}

      {/* O último passo do funil só conta quem passou pela página de sucesso com
          o rastreio ligado, e esse evento começou a ser gravado agora. Enquanto
          os dois números discordarem, o da direita é o verdadeiro — ele vem dos
          pedidos, não do rastreio. */}
      {pedidosPagos !== fechou && (
        <p className="pt-1 text-xs text-gray-400">
          Pedidos do site pagos nesse período:{" "}
          <strong className="font-semibold text-[#07366A]">{pedidosPagos}</strong>.
          {fechou === 0 && pedidosPagos > 0 && (
            <> O passo de cima só conta a partir de agora, quando o rastreio passou
            a registrar o pedido fechado.</>
          )}
        </p>
      )}
    </div>
  );
}
