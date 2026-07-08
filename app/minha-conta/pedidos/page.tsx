import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { auth } from "@/lib/auth";
import { listPedidosDoCliente } from "@/lib/queries/pedidos";
import { STATUS_PEDIDO } from "@/lib/pedido-status";
import { formatBRL } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Meus pedidos | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

export default async function MeusPedidosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/minha-conta/pedidos");

  const pedidos = session.user.email
    ? await listPedidosDoCliente(session.user.email)
    : [];

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg space-y-5">
        <Link
          href="/minha-conta"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#07366A]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Minha conta
        </Link>

        <h1 className="text-xl font-bold text-[#07366A]">Meus pedidos</h1>

        {pedidos.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-8 text-center space-y-3">
            <Package size={28} className="mx-auto text-gray-300" aria-hidden="true" />
            <p className="text-sm text-gray-500">
              Você ainda não tem pedidos por aqui.
            </p>
            <Link
              href="/"
              className="inline-block text-sm font-semibold text-[#FF035C] hover:underline"
            >
              Ver a loja →
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {pedidos.map((p) => (
              <li
                key={p.id}
                className="bg-white rounded-xl shadow-sm border border-black/5 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-[#07366A]">{p.numero}</p>
                  <p className="text-xs text-gray-500">
                    {p.criadoEm.toLocaleDateString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PEDIDO[p.status].badge}`}
                  >
                    {STATUS_PEDIDO[p.status].label}
                  </span>
                  <span className="font-semibold text-[#07366A]">
                    {formatBRL(p.total)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
