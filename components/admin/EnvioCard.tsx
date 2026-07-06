"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  ExternalLink,
  Pencil,
  Printer,
  Truck,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { registrarEnvioManual, atualizarRastreio } from "@/actions/pedidos";
import {
  buildTrackingUrl,
  mensagemRastreio,
  whatsappRastreioLink,
  transportadoraLabel,
} from "@/lib/tracking";
import type { OrderStatus, Transportadora } from "@/lib/generated/prisma/client";

type Props = {
  id: string;
  numero: string;
  status: OrderStatus;
  transportadora: Transportadora | null;
  codigoRastreio: string | null;
  selfTracking: string | null;
  etiquetaUrl: string | null;
  clienteNome: string;
  clienteTelefone: string | null;
};

const inputCls =
  "w-full min-h-10 px-3 rounded-md border border-gray-300 text-sm text-[#07366A] focus:outline-none focus:border-[#07366A] focus:ring-1 focus:ring-[#07366A]/30";

export function EnvioCard({
  id,
  numero,
  status,
  transportadora,
  codigoRastreio,
  selfTracking,
  etiquetaUrl,
  clienteNome,
  clienteTelefone,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [modalAberto, setModalAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // Estado do formulário (registro/edição).
  const [transp, setTransp] = useState<string>(transportadora ?? "JADLOG");
  const [codigo, setCodigo] = useState(codigoRastreio ?? "");

  const enviado = status === "ENVIADO" || status === "ENTREGUE";
  const podeRegistrar = status === "PAGO";
  const editando = enviado; // modal em modo edição quando já enviado

  const url = buildTrackingUrl(selfTracking, codigoRastreio);
  const mensagem = mensagemRastreio({
    nomeCliente: clienteNome,
    numeroPedido: numero,
    transportadora,
    codigo: codigoRastreio ?? "",
    url,
  });
  const waLink = whatsappRastreioLink(clienteTelefone, mensagem);

  function copiar(texto: string, aviso = "Copiado.") {
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiado(true);
        toast.success(aviso);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => toast.error("Não foi possível copiar."));
  }

  function salvar() {
    startTransition(async () => {
      const acao = editando ? atualizarRastreio : registrarEnvioManual;
      const res = await acao(id, { transportadora: transp, codigo });
      if (res.success) {
        toast.success(res.message ?? "Salvo.");
        setModalAberto(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm space-y-3">
      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide flex items-center gap-1.5">
        <Truck className="w-3.5 h-3.5" aria-hidden="true" />
        Envio &amp; rastreio
      </h2>

      {enviado ? (
        <>
          <div className="space-y-1">
            <p className="text-gray-600">
              Transportadora:{" "}
              <span className="text-[#07366A] font-medium">
                {transportadoraLabel(transportadora)}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Código:</span>
              <span className="font-mono text-[#07366A]">
                {codigoRastreio ?? "—"}
              </span>
              {codigoRastreio && (
                <button
                  type="button"
                  onClick={() => copiar(codigoRastreio, "Código copiado.")}
                  className="text-gray-400 hover:text-[#07366A]"
                  aria-label="Copiar código"
                >
                  {copiado ? (
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md bg-green-600 text-white font-medium hover:brightness-110 transition-all"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Enviar rastreio no WhatsApp
              </a>
            ) : (
              <button
                type="button"
                onClick={() => copiar(mensagem, "Mensagem copiada.")}
                className="inline-flex items-center justify-center gap-2 min-h-11 rounded-md border border-gray-300 text-[#07366A] font-medium hover:border-[#07366A] transition-all"
              >
                <Copy className="w-4 h-4" aria-hidden="true" />
                Copiar mensagem de rastreio
              </button>
            )}

            <div className="flex gap-2">
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-10 rounded-md border border-gray-300 text-[#07366A] text-xs font-medium hover:border-[#07366A] transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Abrir rastreio
                </a>
              )}
              <button
                type="button"
                onClick={() => setModalAberto(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-10 rounded-md border border-gray-300 text-[#07366A] text-xs font-medium hover:border-[#07366A] transition-all"
              >
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                Editar rastreio
              </button>
            </div>

            {etiquetaUrl && (
              <a
                href={etiquetaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 min-h-10 rounded-md border border-gray-300 text-[#07366A] text-xs font-medium hover:border-[#07366A] transition-all"
              >
                <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                Imprimir etiqueta (PDF)
              </a>
            )}
          </div>
        </>
      ) : podeRegistrar ? (
        <div className="space-y-2">
          <p className="text-gray-500 text-xs leading-snug">
            Comprou a etiqueta no painel do Melhor Envio ou vai enviar pela Gollog?
            Registre o código aqui para marcar como enviado e avisar o cliente.
          </p>
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center justify-center gap-2 min-h-11 w-full rounded-md bg-[#FF035C] text-white font-medium hover:brightness-110 transition-all"
          >
            <Truck className="w-4 h-4" aria-hidden="true" />
            Registrar envio manual
          </button>
        </div>
      ) : (
        <p className="text-gray-400 text-xs">
          Disponível quando o pedido estiver pago.
        </p>
      )}

      {/* Modal de registro/edição */}
      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !pending && setModalAberto(false)}
        >
          <div
            className="bg-white rounded-lg p-5 w-full max-w-sm space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-[#07366A]">
              {editando ? "Editar rastreio" : "Registrar envio"}
            </h3>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600" htmlFor="ec-transp">
                Transportadora
              </label>
              <select
                id="ec-transp"
                className={inputCls}
                value={transp}
                onChange={(e) => setTransp(e.target.value)}
              >
                <option value="JADLOG">Jadlog</option>
                <option value="GOLLOG">Gollog</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600" htmlFor="ec-codigo">
                Código de rastreio
              </label>
              <input
                id="ec-codigo"
                className={inputCls}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.trim())}
                placeholder="ex.: ME262AHV707BR"
              />
              <p className="text-[11px] text-gray-400 leading-snug">
                Use o código do Melhor Envio (ME…BR) — é o que abre o rastreio num
                clique. {transp === "OUTRO" && "Opcional para “Outro”."}
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                disabled={pending}
                className="px-4 py-2 text-sm text-gray-600 hover:text-[#07366A] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={pending}
                className="px-4 py-2 text-sm bg-[#FF035C] text-white font-medium rounded-md hover:brightness-110 disabled:opacity-50"
              >
                {pending ? "Salvando…" : editando ? "Salvar" : "Marcar como enviado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
