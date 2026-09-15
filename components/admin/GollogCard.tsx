"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, FileDown, Mail, Plane, Save } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import {
  definirEnvioAereo,
  linkConfirmacaoAereo,
  pedirConfirmacaoAereo,
} from "@/actions/envio-aereo";
import type { BaseComDistancia } from "@/lib/gollog/bases";

const inputCls =
  "w-full min-h-10 px-3 rounded-md border border-gray-300 text-sm text-[#07366A] focus:outline-none focus:border-[#07366A] focus:ring-1 focus:ring-[#07366A]/30";

const quando = (d: Date | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

/**
 * Envio aéreo no painel: pedir a confirmação ao cliente, ver o que ele
 * respondeu, ajustar o aeroporto e baixar a minuta da Gollog preenchida.
 */
export function GollogCard({
  orderId,
  numero,
  aberto,
  clienteNome,
  clienteTelefone,
  aeroportoDestino,
  aeroportoMinuta,
  bases,
  recebedorNome,
  recebedorCpf,
  recebedorTelefone,
  pedidaEm,
  confirmadaEm,
}: {
  orderId: string;
  numero: string;
  /** Ainda não saiu: dá para pedir confirmação e mudar a retirada. */
  aberto: boolean;
  clienteNome: string;
  clienteTelefone: string | null;
  aeroportoDestino: string | null;
  /** O que a minuta vai usar agora (escolhido, ou a base da cidade, ou nada). */
  aeroportoMinuta: string | null;
  bases: BaseComDistancia[];
  recebedorNome: string | null;
  recebedorCpf: string | null;
  recebedorTelefone: string | null;
  pedidaEm: Date | null;
  confirmadaEm: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const [aeroporto, setAeroporto] = useState(aeroportoDestino ?? "");
  const [outra, setOutra] = useState(!!recebedorNome);
  const [rNome, setRNome] = useState(recebedorNome ?? "");
  const [rCpf, setRCpf] = useState(recebedorCpf ?? "");
  const [rTel, setRTel] = useState(recebedorTelefone ?? "");
  const [nf, setNf] = useState("");
  const [volumes, setVolumes] = useState("1");

  const base = bases.find((b) => b.iata === aeroportoMinuta) ?? null;

  function pedir() {
    startTransition(async () => {
      const r = await pedirConfirmacaoAereo(orderId);
      if (r.ok) toast.success(`Pedido de confirmação enviado para ${r.para}.`);
      else toast.error(r.error);
    });
  }

  function comLink(acao: (link: string) => void) {
    startTransition(async () => {
      const r = await linkConfirmacaoAereo(orderId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      acao(r.link);
    });
  }

  const mensagem = (link: string) =>
    `Oi ${clienteNome.split(/\s+/)[0]}! Seu pedido ${numero} vai de avião pela Gollog e fica para retirada numa unidade da Gollog. ` +
    `Confirme por aqui o seu endereço, onde vai buscar e quem vai retirar: ${link}`;

  function whatsapp() {
    comLink((link) => {
      let d = (clienteTelefone ?? "").replace(/\D/g, "");
      if (d && !d.startsWith("55")) d = `55${d}`;
      const url = `https://wa.me/${d}?text=${encodeURIComponent(mensagem(link))}`;
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  function copiar() {
    comLink((link) =>
      navigator.clipboard
        .writeText(mensagem(link))
        .then(() => toast.success("Mensagem com o link copiada."))
        .catch(() => toast.error(`Copie na mão: ${link}`)),
    );
  }

  function salvar() {
    startTransition(async () => {
      const r = await definirEnvioAereo(orderId, {
        aeroporto,
        recebedorNome: outra ? rNome : "",
        recebedorCpf: outra ? rCpf : "",
        recebedorTelefone: outra ? rTel : "",
      });
      if (r.ok) toast.success(r.message ?? "Salvo.");
      else toast.error(r.error);
    });
  }

  const hrefMinuta = `/admin/pedidos/${orderId}/minuta?${new URLSearchParams({ nf, volumes })}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm space-y-4">
      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide flex items-center gap-1.5">
        <Plane className="w-3.5 h-3.5" aria-hidden="true" />
        Envio aéreo (Gollog)
      </h2>

      {/* Situação da confirmação */}
      {confirmadaEm ? (
        <p className="flex items-start gap-1.5 text-xs text-green-800 bg-green-50 border border-green-200 rounded-md p-2.5">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          Cliente confirmou em {quando(confirmadaEm)}.
        </p>
      ) : pedidaEm ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          Confirmação pedida em {quando(pedidaEm)}. O cliente ainda não respondeu.
        </p>
      ) : (
        <p className="text-xs text-gray-500">O cliente ainda não recebeu o pedido de confirmação.</p>
      )}

      <div className="space-y-1">
        <p className="text-gray-600">
          Base na minuta:{" "}
          <span className="font-medium text-[#07366A]">
            {base ? `${base.iata} · ${base.cidade}/${base.uf}` : "em branco"}
          </span>
        </p>
        {!aeroportoDestino && base && (
          <p className="text-xs text-gray-400">Unidade da cidade do cliente. Ele ainda não escolheu.</p>
        )}
        {!base && (
          <p className="text-xs text-gray-400">
            A cidade do cliente não tem Gollog e ele não escolheu. Mais perto:{" "}
            {bases[0] ? `${bases[0].iata} (${bases[0].km ?? "?"} km)` : "-"}.
          </p>
        )}
        {recebedorNome && (
          <p className="text-gray-600">
            Quem retira: <span className="text-[#07366A]">{recebedorNome}</span>
          </p>
        )}
      </div>

      {aberto && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={pedir}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 min-h-10 rounded-md bg-[#07366A] text-white font-medium hover:brightness-125 disabled:opacity-60"
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            {pedidaEm ? "Pedir confirmação de novo" : "Pedir confirmação por e-mail"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={whatsapp}
              disabled={pending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-10 rounded-md bg-green-600 text-white text-xs font-medium hover:brightness-110 disabled:opacity-60"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Link no WhatsApp
            </button>
            <button
              type="button"
              onClick={copiar}
              disabled={pending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-10 rounded-md border border-gray-300 text-[#07366A] text-xs font-medium hover:border-[#07366A] disabled:opacity-60"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
              Copiar mensagem
            </button>
          </div>
        </div>
      )}

      {/* Ajuste manual: cliente combinou na conversa */}
      {aberto && (
        <details className="border-t border-gray-100 pt-3">
          <summary className="cursor-pointer text-xs font-medium text-[#07366A]">
            Definir unidade ou quem retira à mão
          </summary>
          <div className="space-y-3 mt-3">
            <select value={aeroporto} onChange={(e) => setAeroporto(e.target.value)} className={inputCls} aria-label="Unidade de retirada">
              <option value="">Sem escolha (usa a unidade da cidade, se houver)</option>
              {bases.map((b) => (
                <option key={b.iata} value={b.iata}>
                  {b.iata} · {b.cidade}/{b.uf}
                  {b.km != null ? ` · ${b.naCidade ? "na cidade" : `${b.km} km`}` : ""}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={outra} onChange={(e) => setOutra(e.target.checked)} className="accent-[#FF035C]" />
              Outra pessoa vai retirar
            </label>
            {outra && (
              <div className="space-y-2">
                <input value={rNome} onChange={(e) => setRNome(e.target.value)} placeholder="Nome completo" className={inputCls} />
                <div className="flex gap-2">
                  <input value={rCpf} onChange={(e) => setRCpf(e.target.value)} placeholder="CPF" inputMode="numeric" className={inputCls} />
                  <input value={rTel} onChange={(e) => setRTel(e.target.value)} placeholder="Telefone" inputMode="tel" className={inputCls} />
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={salvar}
              disabled={pending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-gray-300 text-xs font-medium text-[#07366A] hover:border-[#07366A] disabled:opacity-60"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              Salvar
            </button>
          </div>
        </details>
      )}

      {/* Minuta */}
      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex gap-2">
          <input
            value={nf}
            onChange={(e) => setNf(e.target.value)}
            placeholder="Nota fiscal (ex.: NF-e nº 106 - Série 1)"
            className={inputCls}
            aria-label="Nota fiscal"
          />
          <input
            value={volumes}
            onChange={(e) => setVolumes(e.target.value.replace(/\D/g, "").slice(0, 2))}
            className={`${inputCls} w-16`}
            inputMode="numeric"
            aria-label="Número de caixas"
            title="Número de caixas"
          />
        </div>
        <a
          href={hrefMinuta}
          className="inline-flex items-center justify-center gap-2 min-h-11 w-full rounded-md bg-[#FF035C] text-white font-medium hover:brightness-110 transition-all"
        >
          <FileDown className="w-4 h-4" aria-hidden="true" />
          Baixar minuta Gollog (PDF)
        </a>
        {!confirmadaEm && aberto && (
          <p className="text-[11px] text-gray-400 leading-snug">
            Dá para baixar antes da confirmação, mas o endereço e a unidade podem mudar
            quando o cliente responder.
          </p>
        )}
      </div>
    </div>
  );
}
