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
import type { OrderStatus, TipoEntrega } from "@/lib/generated/prisma/client";

type Props = {
  searchParams: Promise<{
    status?: string;
    q?: string;
    entrega?: string;
    transporte?: string;
  }>;
};

const STATUS_VALIDOS = Object.keys(STATUS_PEDIDO) as OrderStatus[];
const ENTREGA_VALIDAS: TipoEntrega[] = ["ENVIO", "RETIRADA"];
type Transporte = "GOLLOG" | "JADLOG";
const TRANSPORTE_VALIDOS: Transporte[] = ["GOLLOG", "JADLOG"];

// Badge por tipo de entrega (envio = despacha; retirada = cliente busca).
const ENTREGA_BADGE: Record<TipoEntrega, { label: string; badge: string }> = {
  ENVIO: { label: "Envio", badge: "bg-blue-50 text-blue-700" },
  RETIRADA: { label: "Retirada", badge: "bg-amber-50 text-amber-700" },
};

// Badge por transportadora efetiva (Gollog = aéreo; Jadlog = terrestre).
const TRANSPORTE_BADGE: Record<Transporte, { label: string; badge: string }> = {
  GOLLOG: { label: "Gollog · aéreo", badge: "bg-sky-50 text-sky-700" },
  JADLOG: { label: "Jadlog · terrestre", badge: "bg-violet-50 text-violet-700" },
};

function buildHref(status: string, q: string, entrega: string, transporte: string) {
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (q) p.set("q", q);
  if (entrega) p.set("entrega", entrega);
  if (transporte) p.set("transporte", transporte);
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
  const entrega =
    typeof sp.entrega === "string" &&
    ENTREGA_VALIDAS.includes(sp.entrega as TipoEntrega)
      ? (sp.entrega as TipoEntrega)
      : undefined;
  const transporte =
    typeof sp.transporte === "string" &&
    TRANSPORTE_VALIDOS.includes(sp.transporte as Transporte)
      ? (sp.transporte as Transporte)
      : undefined;

  // Varredura oportunista: cancela AGUARDANDO órfãos > 24h sem pagamento
  // aprovado/em-análise. Resiliente — não quebra a lista se falhar.
  await cancelarPedidosAguardandoExpirados().catch(() => 0);

  const pedidos = await listPedidos({ status, q, entrega, transporte });

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

      {/* Filtro por status (preserva a busca e o tipo de entrega) */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Link
          href={buildHref("", q, entrega ?? "", transporte ?? "")}
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
            href={buildHref(s, q, entrega ?? "", transporte ?? "")}
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

      {/* Filtro por tipo de entrega (preserva status, busca e transportadora) */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Link
          href={buildHref(status ?? "", q, "", transporte ?? "")}
          className={`px-3 py-1 rounded-full text-xs font-medium border ${
            !entrega
              ? "bg-[#07366A] text-white border-[#07366A]"
              : "bg-white text-gray-600 border-gray-300 hover:border-[#07366A]"
          }`}
        >
          Toda entrega
        </Link>
        {ENTREGA_VALIDAS.map((t) => (
          <Link
            key={t}
            href={buildHref(status ?? "", q, t, transporte ?? "")}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              entrega === t
                ? "bg-[#07366A] text-white border-[#07366A]"
                : "bg-white text-gray-600 border-gray-300 hover:border-[#07366A]"
            }`}
          >
            {ENTREGA_BADGE[t].label}
          </Link>
        ))}
      </div>

      {/* Filtro por transportadora (Gollog aéreo × Jadlog terrestre) */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Link
          href={buildHref(status ?? "", q, entrega ?? "", "")}
          className={`px-3 py-1 rounded-full text-xs font-medium border ${
            !transporte
              ? "bg-[#07366A] text-white border-[#07366A]"
              : "bg-white text-gray-600 border-gray-300 hover:border-[#07366A]"
          }`}
        >
          Toda transportadora
        </Link>
        {TRANSPORTE_VALIDOS.map((t) => (
          <Link
            key={t}
            href={buildHref(status ?? "", q, entrega ?? "", t)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              transporte === t
                ? "bg-[#07366A] text-white border-[#07366A]"
                : "bg-white text-gray-600 border-gray-300 hover:border-[#07366A]"
            }`}
          >
            {TRANSPORTE_BADGE[t].label}
          </Link>
        ))}
      </div>

      {/* Busca (preserva o status e o tipo de entrega) */}
      <form method="get" className="mb-4 relative max-w-sm">
        {status && <input type="hidden" name="status" value={status} />}
        {entrega && <input type="hidden" name="entrega" value={entrega} />}
        {transporte && <input type="hidden" name="transporte" value={transporte} />}
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
          {q || status || entrega ? (
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
                <th className="px-4 py-3">Entrega</th>
                <th className="px-4 py-3">Transportadora</th>
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
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ENTREGA_BADGE[p.tipoEntrega].badge}`}
                    >
                      {ENTREGA_BADGE[p.tipoEntrega].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {p.tipoEntrega === "RETIRADA" ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : p.transporte ? (
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TRANSPORTE_BADGE[p.transporte].badge}`}
                        >
                          {TRANSPORTE_BADGE[p.transporte].label}
                        </span>
                        {p.codigoRastreio && (
                          <span className="font-mono text-[11px] text-gray-400">
                            {p.codigoRastreio}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        a definir
                      </span>
                    )}
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
