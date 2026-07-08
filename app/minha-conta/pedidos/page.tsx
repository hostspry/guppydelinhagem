import type { Metadata } from "next";
import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { listPedidosDoUsuario } from "@/lib/queries/minha-conta";
import { STATUS_PEDIDO } from "@/lib/pedido-status";
import { formatBRL } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Meus pedidos | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

function resumoItens(itens: { nomeProduto: string; quantidade: number }[]): string {
  if (itens.length === 0) return "";
  const [primeiro, ...resto] = itens;
  const base = `${primeiro.nomeProduto} (x${primeiro.quantidade})`;
  if (resto.length === 0) return base;
  return `${base} +${resto.length} ${resto.length === 1 ? "item" : "itens"}`;
}

export default async function ListaPedidosPage() {
  const session = await auth();
  const user = session!.user;
  const pedidos = await listPedidosDoUsuario(user.id, user.email);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-[#07366A]">Meus pedidos</h1>

      {pedidos.length === 0 ? (
        <div className="rounded-2xl bg-white border border-black/5 p-8 text-center space-y-3 shadow-sm">
          <Package size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500">Você ainda não tem pedidos.</p>
          <Link
            href="/"
            className="inline-block text-sm font-semibold text-[#FF035C] hover:underline"
          >
            Conhecer os guppys →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {pedidos.map((p) => (
            <li key={p.id}>
              <Link
                href={`/minha-conta/pedidos/${p.numero.replace(/^#/, "")}`}
                className="flex items-center gap-4 rounded-xl bg-white border border-black/5 p-4 shadow-sm hover:border-[#07366A] transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono font-semibold text-[#07366A]">
                      {p.numero}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PEDIDO[p.status].badge}`}
                    >
                      {STATUS_PEDIDO[p.status].label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {p.criadoEm.toLocaleDateString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {resumoItens(p.items)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-[#07366A]">
                    {formatBRL(p.total)}
                  </span>
                  <ChevronRight size={18} className="text-gray-400" aria-hidden="true" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
