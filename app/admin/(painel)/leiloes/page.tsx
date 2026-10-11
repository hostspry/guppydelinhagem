import Link from "next/link";
import { Gavel, Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { listLeiloes } from "@/lib/queries/leiloes";
import { dataLeilaoBR } from "@/lib/leiloes/situacao";

export const dynamic = "force-dynamic";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function LeiloesPage() {
  const leiloes = await listLeiloes();

  return (
    <div>
      <PageHeader
        title="Leilões"
        description="Lance os lotes arrematados, cobre cada arrematante com um link e acompanhe quem já pagou."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Leilões" }]}
        action={
          <Link
            href="/admin/leiloes/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo leilão
          </Link>
        }
      />

      {leiloes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Gavel className="w-8 h-8 text-gray-300 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-gray-500 mb-3">Nenhum leilão cadastrado ainda.</p>
          <Link href="/admin/leiloes/novo" className="text-sm text-[#FF035C] hover:underline font-medium">
            Cadastrar o primeiro leilão →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Leilão</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-center">Lotes</th>
                <th className="px-4 py-3 text-right">Arrematado</th>
                <th className="px-4 py-3 text-center">Pagas</th>
                <th className="px-4 py-3 text-right">Recebido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leiloes.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/leiloes/${l.id}`} className="font-medium text-[#07366A] hover:underline">
                      {l.nome}
                    </Link>
                    {l.lotesSemCobranca > 0 && (
                      <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {l.lotesSemCobranca} sem cobrança
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{dataLeilaoBR(l.dataLeilao)}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{l.qtdLotes}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{moeda.format(l.totalArrematado)}</td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {l.cobrancas ? `${l.pagas}/${l.cobrancas}` : "·"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">{moeda.format(l.recebido)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
