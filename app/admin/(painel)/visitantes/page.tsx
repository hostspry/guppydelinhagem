import Link from "next/link";
import { Eye, MousePointerClick, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { LimpezaRastreio } from "@/components/admin/LimpezaRastreio";
import {
  listarVisitantes,
  produtosMaisVistos,
  resumoRastreio,
} from "@/lib/queries/visitantes";

const dataHoraBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const dataBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

export default async function VisitantesPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p } = await searchParams;
  const pagina = Number(p) > 0 ? Number(p) : 1;

  const [lista, produtos, resumo] = await Promise.all([
    listarVisitantes(pagina),
    produtosMaisVistos(30),
    resumoRastreio(),
  ]);

  return (
    <div>
      <PageHeader
        title="Visitantes"
        description="Quem entrou no site, de onde, e o que olhou."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Visitantes" }]}
        action={<LimpezaRastreio pendentes={resumo.temMaisDe90Dias} />}
      />

      {resumo.temMaisDe90Dias > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Existem <strong>{resumo.temMaisDe90Dias}</strong> registros com mais de
          90 dias
          {resumo.registroMaisAntigo && (
            <> (o mais antigo é de {dataBR.format(resumo.registroMaisAntigo)})</>
          )}
          . Nada é apagado sozinho — se não precisar mais deles, use o botão de
          limpar aí em cima.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard
          icon={Users}
          label="Visitantes"
          value={resumo.visitantes}
          description="pessoas distintas já vistas"
        />
        <StatCard
          icon={MousePointerClick}
          label="Visitas (7 dias)"
          value={resumo.sessoes7d}
          description="sessões na última semana"
        />
        <StatCard
          icon={Eye}
          label="Eventos"
          value={resumo.eventos}
          description="passos registrados no total"
        />
      </div>

      {produtos.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
            Peixes mais olhados (30 dias)
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="pb-2">Produto</th>
                <th className="pb-2 text-right w-24">Olhadas</th>
                <th className="pb-2 text-right w-28">Foi ao carrinho</th>
                <th className="pb-2 text-right w-24">Conversão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {produtos.map((p) => (
                <tr key={p.produtoId}>
                  <td className="py-2 text-[#07366A]">{p.nome}</td>
                  <td className="py-2 text-right text-gray-600">{p.vistas}</td>
                  <td className="py-2 text-right text-gray-600">{p.carrinho}</td>
                  <td className="py-2 text-right text-gray-500">
                    {p.vistas > 0
                      ? `${Math.round((p.carrinho / p.vistas) * 100)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-2">
        Últimos visitantes
      </h2>

      {lista.itens.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          Ninguém registrado ainda. A partir de agora, cada visita ao site
          aparece aqui.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Quem</th>
                <th className="px-4 py-3">De onde</th>
                <th className="px-4 py-3 text-center w-20">Visitas</th>
                <th className="px-4 py-3 text-center w-20">Passos</th>
                <th className="px-4 py-3 w-32">Última vez</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.itens.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/visitantes/${v.id}`}
                      className="text-[#07366A] hover:text-[#FF035C] font-medium"
                    >
                      {v.clienteNome ?? "Visitante anônimo"}
                    </Link>
                    {v.comprou && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                        comprou
                      </span>
                    )}
                    {v.clienteEmail && (
                      <span className="block text-xs text-gray-400 break-all">
                        {v.clienteEmail}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {v.ultimaCidade ?? "—"}
                    <span className="block text-xs text-gray-400">
                      {[v.ultimoProvedor, v.ultimoDispositivo, v.ultimoIp]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {v.totalSessoes}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {v.totalEventos}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {dataHoraBR.format(v.ultimoAcesso)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lista.paginas > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">
            {lista.total} visitante(s) · página {pagina} de {lista.paginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link
                href={`/admin/visitantes?p=${pagina - 1}`}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:border-gray-400"
              >
                Anterior
              </Link>
            )}
            {pagina < lista.paginas && (
              <Link
                href={`/admin/visitantes?p=${pagina + 1}`}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:border-gray-400"
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
