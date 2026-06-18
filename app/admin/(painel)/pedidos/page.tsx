import Link from "next/link";
import { Plus, Pencil, Eye, Search } from "lucide-react";
import {
  listPedidos,
  cancelarPedidosAguardandoExpirados,
} from "@/lib/queries/pedidos";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeletePedidoButton } from "@/components/admin/DeletePedidoButton";
import { STATUS_PEDIDO } from "@/lib/pedido-status";
import { formatBRL } from "@/lib/utils/format";
import type { OrderStatus } from "@/lib/generated/prisma/client";

type Props = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

const STATUS_VALIDOS = Object.keys(STATUS_PEDIDO) as OrderStatus[];

function buildHref(status: string, q: string) {
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (q) p.set("q", q);
  const qs = p.toString();
  return qs ? `/admin/pedidos?${qs}` : "/admin/pedidos";
}

export default async function PedidosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status =
    typeof sp.status === "string" && STATUS_VALIDOS.includes(sp.status as OrderStatus)
      ? (sp.status as OrderStatus)
      : undefined;

  // Varredura oportunista: cancela AGUARDANDO órfãos > 24h sem pagamento
  // aprovado/em-análise. Resiliente — não quebra a lista se falhar.
  await cancelarPedidosAguardandoExpirados().catch(() => 0);

  const pedidos = await listPedidos({ status, q });

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Pedidos manuais — itens do catálogo ou avulsos, frete e status."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Pedidos" }]}
        action={
          <Link
            href="/admin/pedidos/novo"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo pedido
          </Link>
        }
      />

      {/* Filtro por status (preserva a busca) */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Link
          href={buildHref("", q)}
          className={`px-3 py-1 rounded-full text-xs font-medium border ${
            !status
              ? "bg-[#07366A] text-white border-[#07366A]"
              : "bg-white text-gray-600 border-gray-300 hover:border-[#07366A]"
          }`}
        >
          Todos
        </Link>
        {STATUS_VALIDOS.map((s) => (
          <Link
            key={s}
            href={buildHref(s, q)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              status === s
                ? "bg-[#07366A] text-white border-[#07366A]"
                : "bg-white text-gray-600 border-gray-300 hover:border-[#07366A]"
            }`}
          >
            {STATUS_PEDIDO[s].label}
          </Link>
        ))}
      </div>

      {/* Busca (preserva o status) */}
      <form method="get" className="mb-4 relative max-w-sm">
        {status && <input type="hidden" name="status" value={status} />}
        <Search
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por número ou cliente"
          aria-label="Buscar pedidos"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
        />
      </form>

      {pedidos.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          {q || status ? (
            <p className="text-sm text-gray-500">
              Nenhum pedido encontrado.{" "}
              <Link href="/admin/pedidos" className="text-[#FF035C] hover:underline">
                Limpar filtros
              </Link>
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-3">
                Nenhum pedido cadastrado ainda.
              </p>
              <Link
                href="/admin/pedidos/novo"
                className="text-sm text-[#FF035C] hover:underline font-medium"
              >
                Criar primeiro pedido →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3 text-right w-28">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-[#07366A]">
                    <Link
                      href={`/admin/pedidos/${p.id}`}
                      className="hover:text-[#FF035C]"
                    >
                      {p.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.clienteNome}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PEDIDO[p.status].badge}`}
                    >
                      {STATUS_PEDIDO[p.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#07366A]">
                    {formatBRL(p.total)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.criadoEm.toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/admin/pedidos/${p.id}`}
                        className="text-gray-400 hover:text-[#07366A] p-1"
                        aria-label={`Ver ${p.numero}`}
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <Link
                        href={`/admin/pedidos/${p.id}/editar`}
                        className="text-gray-400 hover:text-[#07366A] p-1"
                        aria-label={`Editar ${p.numero}`}
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      <DeletePedidoButton id={p.id} numero={p.numero} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
