"use client";

import { SERIE, CHROME } from "./paleta";

export type ItemRanking = { rotulo: string; total: number; extra?: string };

/**
 * Ranking em barras horizontais: origem da visita, cidade, dispositivo.
 *
 * Uma série só, então não leva legenda — o título do bloco já diz o que está
 * medido, e uma caixinha com um quadrado repetiria o título ocupando espaço.
 * Cada barra leva o número na ponta, então nada aqui depende de passar o mouse.
 *
 * Barra horizontal e não pizza: comparar comprimento é fácil, comparar ângulo
 * não é. E o rótulo cabe por extenso ao lado, sem legenda para decorar.
 */
export function BarrasRanking({
  itens,
  unidade = "visitas",
  vazio = "Nada registrado nesse período.",
}: {
  itens: ItemRanking[];
  unidade?: string;
  vazio?: string;
}) {
  if (itens.length === 0) {
    return <p className="text-sm text-gray-500">{vazio}</p>;
  }

  const maior = Math.max(...itens.map((i) => i.total), 1);
  const total = itens.reduce((s, i) => s + i.total, 0);

  return (
    <ul className="space-y-2">
      {itens.map((i) => {
        const parte = total > 0 ? Math.round((i.total / total) * 100) : 0;
        return (
          <li key={i.rotulo}>
            <div className="flex items-baseline justify-between gap-3 mb-0.5">
              <span className="text-xs text-gray-600 truncate" title={i.rotulo}>
                {i.rotulo}
                {i.extra && <span className="text-gray-400"> · {i.extra}</span>}
              </span>
              <span className="text-xs whitespace-nowrap tabular-nums" style={{ color: CHROME.texto }}>
                <strong className="font-semibold">{i.total.toLocaleString("pt-BR")}</strong>
                <span className="text-gray-400"> {unidade} · {parte}%</span>
              </span>
            </div>
            {/* Trilho recessivo atrás da barra: dá a escala sem precisar de eixo. */}
            <div className="h-2 rounded-full" style={{ backgroundColor: CHROME.grade }}>
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${Math.max((i.total / maior) * 100, 2)}%`,
                  backgroundColor: SERIE.um,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
