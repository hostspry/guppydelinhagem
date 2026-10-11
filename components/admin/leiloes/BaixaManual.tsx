"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { EnvioFora, FormaPagamentoFora } from "@/actions/leiloes";

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const campo = "border border-gray-300 rounded-md px-2 py-1.5 bg-white text-sm";

/**
 * Baixa manual: o arrematante pagou direto (Pix, PicPay). O mesmo formulário
 * serve na lista de lotes (antes de existir cobrança) e no cartão da cobrança.
 * Se o cliente já escolheu o frete no link, o frete e o envio dele valem.
 */
export function BaixaManualForm({
  titulo,
  lotes,
  subtotal,
  freteDoLink,
  onConfirmar,
  onFechar,
}: {
  titulo: string;
  lotes: { nome: string; valor: number }[];
  subtotal: number;
  /** Frete que o cliente já escolheu no link (nulo = ainda não escolheu). */
  freteDoLink: number | null;
  onConfirmar: (input: {
    forma: FormaPagamentoFora;
    frete: number;
    envio: EnvioFora;
  }) => Promise<{ success: boolean; error?: string; message?: string }>;
  onFechar: () => void;
}) {
  const [forma, setForma] = useState<FormaPagamentoFora>("PIX");
  const [envio, setEnvio] = useState<EnvioFora>("COMBINAR");
  const [freteTxt, setFreteTxt] = useState("");
  const [isPending, startTransition] = useTransition();

  const freteDigitado = Number((freteTxt || "0").replace(/\./g, "").replace(",", "."));
  const frete = freteDoLink ?? (envio === "RETIRADA" ? 0 : freteDigitado);
  const freteOk = Number.isFinite(frete) && frete >= 0;

  function confirmar() {
    if (!freteOk) {
      toast.error("Frete inválido.");
      return;
    }
    if (!confirm(`Dar baixa de ${moeda(subtotal + frete)} (${titulo})? Os lotes ficam pagos e nenhum link de cobrança sai.`)) {
      return;
    }
    startTransition(async () => {
      const r = await onConfirmar({ forma, frete, envio });
      if (r.success) {
        toast.success(r.message ?? "Baixa registrada.");
        onFechar();
      } else {
        toast.error(r.error ?? "Não deu certo.");
      }
    });
  }

  return (
    <div className="rounded-md border border-green-200 bg-green-50/70 p-4 text-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-green-900">Baixa manual · {titulo}</p>
          <p className="text-xs text-gray-600">
            Para quem pagou direto no Pix ou no PicPay. Quita todos os lotes abaixo.
          </p>
        </div>
        <button type="button" onClick={onFechar} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="text-xs text-gray-700 space-y-0.5">
        {lotes.map((l, i) => (
          <li key={i} className="flex justify-between gap-3">
            <span className="truncate">{l.nome}</span>
            <span className="whitespace-nowrap">{moeda(l.valor)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-3 text-xs">
        <label className="space-y-1">
          <span className="block text-gray-500">Como pagou</span>
          <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamentoFora)} className={campo}>
            <option value="PIX">Pix direto</option>
            <option value="PICPAY">PicPay</option>
            <option value="OUTRO">Outro</option>
          </select>
        </label>

        {freteDoLink == null ? (
          <>
            <label className="space-y-1">
              <span className="block text-gray-500">Envio</span>
              <select value={envio} onChange={(e) => setEnvio(e.target.value as EnvioFora)} className={campo}>
                <option value="COMBINAR">Combinar depois</option>
                <option value="TERRESTRE">Terrestre (Jadlog)</option>
                <option value="AEREO">Aéreo (Gollog)</option>
                <option value="RETIRADA">Retirada em Guarapari</option>
              </select>
            </label>
            {envio !== "RETIRADA" && (
              <label className="space-y-1">
                <span className="block text-gray-500">Frete pago junto (R$)</span>
                <input
                  value={freteTxt}
                  onChange={(e) => setFreteTxt(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={`${campo} w-24`}
                />
              </label>
            )}
          </>
        ) : (
          <span className="text-gray-600 pb-1.5">Frete escolhido no link: {moeda(freteDoLink)}</span>
        )}

        <div className="ml-auto text-right">
          <span className="block text-gray-500">Total recebido</span>
          <span className="text-base font-bold text-green-800">{freteOk ? moeda(subtotal + frete) : "·"}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={isPending}
        onClick={confirmar}
        className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Registrando…" : "Confirmar baixa"}
      </button>
    </div>
  );
}
