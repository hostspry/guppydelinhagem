import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Truck,
  MapPin,
  Plane,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { getPedidoDoUsuario } from "@/lib/queries/minha-conta";
import { STATUS_PEDIDO } from "@/lib/pedido-status";
import { formatBRL } from "@/lib/utils/format";
import { buildTrackingUrl, transportadoraLabel } from "@/lib/tracking";
import { whatsappLink } from "@/lib/constants";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import CopiarCodigo from "@/components/conta/CopiarCodigo";
import ComprarNovamenteButton from "@/components/conta/ComprarNovamenteButton";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export const metadata: Metadata = {
  title: "Detalhe do pedido | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

// Passos da timeline (CANCELADO é estado terminal alternativo, tratado à parte).
const PASSOS: { status: OrderStatus; label: string }[] = [
  { status: "AGUARDANDO_PAGAMENTO", label: "Aguardando pagamento" },
  { status: "PAGO", label: "Pago" },
  { status: "ENVIADO", label: "Enviado" },
  { status: "ENTREGUE", label: "Entregue" },
];

type Props = { params: Promise<{ numero: string }> };

export default async function DetalhePedidoPage({ params }: Props) {
  const { numero } = await params;
  const session = await auth();
  const user = session!.user;

  const pedido = await getPedidoDoUsuario(numero, user.id, user.email);
  if (!pedido) notFound();

  const e = pedido.endereco;
  const enviado =
    pedido.status === "ENVIADO" || pedido.status === "ENTREGUE";
  const cancelado = pedido.status === "CANCELADO";
  const passoAtual = PASSOS.findIndex((p) => p.status === pedido.status);
  const rastrearUrl = buildTrackingUrl(pedido.selfTracking, pedido.codigoRastreio);
  const garantiaHref = whatsappLink(
    `Olá! Preciso de ajuda com o pedido ${pedido.numero} (garantia de chegada viva).`,
  );

  const enderecoLinhas = [
    e.logradouro && `${e.logradouro}${e.numero ? `, ${e.numero}` : ""}`,
    e.complemento,
    e.bairro,
    [e.cidade, e.uf].filter(Boolean).join(" / "),
    e.cep,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <Link
        href="/minha-conta/pedidos"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#07366A]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Meus pedidos
      </Link>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-[#07366A]">
          Pedido {pedido.numero}
        </h1>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_PEDIDO[pedido.status].badge}`}
        >
          {STATUS_PEDIDO[pedido.status].label}
        </span>
      </div>

      {/* ── Timeline (ou banner de cancelado) ── */}
      {cancelado ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <XCircle size={18} aria-hidden="true" />
          Este pedido foi cancelado.
        </div>
      ) : (
        <ol className="flex items-center gap-1">
          {PASSOS.map((passo, i) => {
            const concluido = i < passoAtual;
            const atual = i === passoAtual;
            return (
              <li key={passo.status} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full flex items-center">
                  <div
                    className={`h-1 flex-1 rounded ${i === 0 ? "opacity-0" : concluido || atual ? "bg-[#07366A]" : "bg-gray-200"}`}
                  />
                  <span
                    className={`grid place-items-center w-7 h-7 rounded-full shrink-0 text-white ${
                      concluido
                        ? "bg-[#07366A]"
                        : atual
                          ? "bg-[#FF035C]"
                          : "bg-gray-300"
                    }`}
                  >
                    {concluido ? <Check size={14} aria-hidden="true" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                  </span>
                  <div
                    className={`h-1 flex-1 rounded ${i === PASSOS.length - 1 ? "opacity-0" : concluido ? "bg-[#07366A]" : "bg-gray-200"}`}
                  />
                </div>
                <span
                  className={`text-[11px] text-center leading-tight ${atual ? "font-semibold text-[#FF035C]" : concluido ? "text-[#07366A]" : "text-gray-400"}`}
                >
                  {passo.label}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* ── Bloco de rastreio ── */}
      {enviado && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <p className="flex items-center gap-2 font-semibold text-blue-900">
            {pedido.transportadora === "GOLLOG" ? (
              <Plane size={18} aria-hidden="true" />
            ) : (
              <Truck size={18} aria-hidden="true" />
            )}
            Rastreio {pedido.transportadora ? `· ${transportadoraLabel(pedido.transportadora)}` : ""}
          </p>

          {pedido.codigoRastreio ? (
            <div className="space-y-3">
              <CopiarCodigo codigo={pedido.codigoRastreio} />

              {pedido.transportadora === "GOLLOG" && (
                <p className="text-sm text-blue-900/80">
                  Retirada na base GOLLOG do seu aeroporto. Apresente este código
                  (AWB) e um documento com foto.
                </p>
              )}

              {rastrearUrl && (
                <a
                  href={rastrearUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#07366A] hover:underline"
                >
                  Acompanhar a entrega →
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-blue-900/80">
              Código de rastreio em breve — a gente te avisa.
            </p>
          )}
        </div>
      )}

      {/* ── Itens ── */}
      <div className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-[#07366A]">Itens</h2>
        <ul className="divide-y divide-gray-100">
          {pedido.itens.map((it, idx) => {
            const unit = Math.max(0, it.precoUnitario - it.descontoUnitario);
            return (
              <li key={idx} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#07366A]">
                    {it.nome}
                    {it.composicao ? (
                      <span className="text-gray-400 font-normal">
                        {" "}· {COMPOSICAO_LABEL[it.composicao]}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-500">
                    {it.quantidade} × {formatBRL(unit)}
                  </p>
                </div>
                <span className="font-semibold text-[#07366A] shrink-0">
                  {formatBRL(unit * it.quantidade)}
                </span>
              </li>
            );
          })}
        </ul>

        <dl className="pt-2 border-t border-gray-100 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <dt>Subtotal</dt>
            <dd>{formatBRL(pedido.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-gray-500">
            <dt>Frete</dt>
            <dd>{pedido.frete > 0 ? formatBRL(pedido.frete) : "Grátis"}</dd>
          </div>
          {pedido.desconto > 0 && (
            <div className="flex justify-between text-green-700">
              <dt>Desconto</dt>
              <dd>− {formatBRL(pedido.desconto)}</dd>
            </div>
          )}
          <div className="flex justify-between font-bold text-[#07366A] text-base pt-1">
            <dt>Total</dt>
            <dd>{formatBRL(pedido.total)}</dd>
          </div>
        </dl>
      </div>

      {/* ── Endereço de entrega ── */}
      {enderecoLinhas.length > 0 && (
        <div className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#07366A]">
            <MapPin size={16} aria-hidden="true" />
            Endereço de entrega
          </h2>
          {e.nome && <p className="text-sm font-medium text-[#07366A]">{e.nome}</p>}
          <p className="text-sm text-gray-600 leading-relaxed">
            {enderecoLinhas.join(" · ")}
          </p>
        </div>
      )}

      {/* ── Garantia de chegada viva (só quando enviado/entregue) ── */}
      {enviado && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#07366A]">
            <MessageCircle size={16} aria-hidden="true" />
            Algum problema com a chegada dos seus peixes?
          </p>
          <p className="text-sm text-gray-500">
            A gente resolve pelo WhatsApp, direto com o criador.
          </p>
          <a
            href={garantiaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 min-h-11 px-5 rounded-pill bg-green-500 text-white font-semibold text-sm hover:bg-green-600 transition-colors"
          >
            <WhatsAppIcon className="w-4 h-4" />
            Falar no WhatsApp
          </a>
        </div>
      )}

      {/* ── Comprar novamente ── */}
      <div className="flex justify-end">
        <ComprarNovamenteButton numero={pedido.numero} />
      </div>
    </div>
  );
}
