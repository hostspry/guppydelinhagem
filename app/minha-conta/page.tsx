import type { Metadata } from "next";
import Link from "next/link";
import { Package, Clock, ArrowRight, Truck } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  listPedidosDoUsuario,
  listEsperasDoUsuario,
} from "@/lib/queries/minha-conta";
import { STATUS_PEDIDO } from "@/lib/pedido-status";
import { formatBRL } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Minha conta | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

function pedidoHref(numero: string): string {
  return `/minha-conta/pedidos/${numero.replace(/^#/, "")}`;
}

export default async function VisaoGeralPage() {
  const session = await auth();
  const user = session!.user; // o layout garante a sessão
  const [pedidos, esperas] = await Promise.all([
    listPedidosDoUsuario(user.id, user.email),
    listEsperasDoUsuario(user.id, null),
  ]);

  const ultimo = pedidos[0] ?? null;
  const primeiro = (user.name ?? "").trim().split(/\s+/)[0];
  const enviado =
    ultimo && (ultimo.status === "ENVIADO" || ultimo.status === "ENTREGUE");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#07366A]">
          Olá{primeiro ? `, ${primeiro}` : ""}!
        </h1>
        <p className="text-sm text-gray-500">
          Aqui você acompanha seus pedidos e sua conta.
        </p>
      </div>

      {/* Rastreio em destaque quando o último pedido saiu pra entrega */}
      {ultimo && enviado && ultimo.codigoRastreio && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-2">
          <p className="flex items-center gap-2 font-semibold text-blue-800">
            <Truck size={18} aria-hidden="true" />
            Seu pedido {ultimo.numero} está a caminho
          </p>
          <p className="text-sm text-blue-900/80">
            Código de rastreio:{" "}
            <code className="font-mono font-semibold">{ultimo.codigoRastreio}</code>
          </p>
          <Link
            href={pedidoHref(ultimo.numero)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF035C] hover:underline"
          >
            Ver rastreio e detalhes
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Último pedido */}
        <div className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#07366A]">
            <Package size={16} aria-hidden="true" />
            Último pedido
          </p>
          {ultimo ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono font-semibold text-[#07366A]">
                  {ultimo.numero}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_PEDIDO[ultimo.status].badge}`}
                >
                  {STATUS_PEDIDO[ultimo.status].label}
                </span>
              </div>
              <p className="text-sm text-gray-500">{formatBRL(ultimo.total)}</p>
              <Link
                href={pedidoHref(ultimo.numero)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF035C] hover:underline"
              >
                Ver pedido
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Você ainda não fez pedidos.{" "}
              <Link href="/" className="text-[#FF035C] hover:underline font-medium">
                Ver a loja
              </Link>
            </p>
          )}
        </div>

        {/* Lista de espera */}
        <div className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#07366A]">
            <Clock size={16} aria-hidden="true" />
            Lista de espera
          </p>
          <p className="text-3xl font-bold text-[#07366A] leading-none">
            {esperas.length}
          </p>
          <p className="text-sm text-gray-500">
            {esperas.length === 1
              ? "peixe que você quer avisar quando voltar"
              : "peixes que você quer avisar quando voltarem"}
          </p>
          <Link
            href="/minha-conta/espera"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF035C] hover:underline"
          >
            Ver lista
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Atalhos */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/minha-conta/pedidos", label: "Meus pedidos" },
          { href: "/minha-conta/perfil", label: "Meu perfil" },
          { href: "/minha-conta/enderecos", label: "Meus endereços" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-[#07366A] hover:border-[#07366A] transition-colors"
          >
            {a.label}
            <ArrowRight size={15} className="text-gray-400" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
