import Link from "next/link";
import { FileText, Pencil } from "lucide-react";
import type { LancamentoItem } from "@/lib/queries/financeiro";
import { dataBR, moedaBR } from "@/lib/financeiro/periodo";
import { ExcluirLancamentoButton } from "./ExcluirLancamentoButton";

const ORIGEM_ROTULO: Record<string, string> = {
  PEDIDO: "venda do site",
  TAXA_PAGAMENTO: "taxa",
  FRETE: "postagem",
  RECORRENCIA: "conta fixa",
  COMPROVANTE: "comprovante",
};

export function ListaLancamentos({
  lancamentos,
  vazio,
}: {
  lancamentos: LancamentoItem[];
  vazio: string;
}) {
  if (lancamentos.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-sm text-gray-500">{vazio}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-3 w-24">Data</th>
            <th className="px-4 py-3">Descrição</th>
            <th className="px-4 py-3">Categoria</th>
            <th className="px-4 py-3 text-right w-32">Valor</th>
            <th className="px-4 py-3 text-right w-20">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lancamentos.map((l) => {
            const entrada = l.tipo === "ENTRADA";
            const pendente = l.status === "PENDENTE";
            return (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {dataBR.format(l.data)}
                </td>
                <td className="px-4 py-3">
                  <span className="text-[#07366A]">{l.descricao}</span>
                  <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {l.origem !== "MANUAL" && ORIGEM_ROTULO[l.origem] && (
                      <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {ORIGEM_ROTULO[l.origem]}
                      </span>
                    )}
                    {pendente && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        não entrou no caixa
                      </span>
                    )}
                    {l.orderNumero && (
                      <Link
                        href={`/admin/pedidos/${l.orderId}`}
                        className="text-[10px] text-gray-400 hover:text-[#FF035C]"
                      >
                        {l.orderNumero}
                      </Link>
                    )}
                    {l.comprovanteUrl && (
                      <a
                        href={l.comprovanteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-[#FF035C]"
                      >
                        <FileText className="w-3 h-3" aria-hidden="true" />
                        comprovante
                      </a>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {l.categoriaNome ?? "—"}
                </td>
                <td
                  className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                    pendente
                      ? "text-gray-400"
                      : entrada
                        ? "text-green-700"
                        : "text-[#FF035C]"
                  }`}
                >
                  {entrada ? "+" : "−"} {moedaBR.format(l.valor)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Link
                      href={`/admin/financeiro/${l.id}/editar`}
                      className="text-gray-400 hover:text-[#07366A] p-1"
                      aria-label={`Editar ${l.descricao}`}
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    <ExcluirLancamentoButton id={l.id} descricao={l.descricao} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
