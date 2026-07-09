import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  listPedidos,
  cancelarPedidosAguardandoExpirados,
} from "@/lib/queries/pedidos";
import { PageHeader } from "@/components/admin/PageHeader";
import PedidosTabela from "@/components/admin/PedidosTabela";
import { STATUS_PEDIDO } from "@/lib/pedido-status";
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
        <PedidosTabela pedidos={pedidos} />
      )}
    </div>
  );
}
