"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { salvarConfiguracaoLoja } from "@/actions/config";

const inputClass =
  "w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function ConfiguracoesForm({
  inicial,
}: {
  inicial: {
    descontoPixGlobalPercent: number;
    freteGratisAtivo: boolean;
    freteGratisAcimaDe: number | null;
  };
}) {
  const [pct, setPct] = useState(String(inicial.descontoPixGlobalPercent));
  const [freteGratisAtivo, setFreteGratisAtivo] = useState(
    inicial.freteGratisAtivo,
  );
  const [freteGratisAcimaDe, setFreteGratisAcimaDe] = useState(
    inicial.freteGratisAcimaDe == null ? "" : String(inicial.freteGratisAcimaDe),
  );
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("descontoPixGlobalPercent", pct);
    if (freteGratisAtivo) fd.set("freteGratisAtivo", "on");
    fd.set("freteGratisAcimaDe", freteGratisAcimaDe);
    startTransition(async () => {
      const r = await salvarConfiguracaoLoja(fd);
      if (r.success) toast.success(r.message ?? "Salvo.");
      else toast.error(r.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl space-y-8"
    >
      <div>
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Desconto Pix global
        </h2>
        <label
          htmlFor="descontoPixGlobalPercent"
          className="block text-sm text-gray-700 mb-1"
        >
          Desconto Pix global (%)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="descontoPixGlobalPercent"
            name="descontoPixGlobalPercent"
            type="number"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className={inputClass}
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
        <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
          Aplicado no Pix aos produtos marcados com{" "}
          <strong>&ldquo;usar desconto Pix global&rdquo;</strong> que não têm
          desconto próprio. Produtos com desconto próprio usam o deles; sem
          nenhum, Pix = preço cheio.
        </p>
      </div>

      {/* ── Frete grátis ── */}
      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Frete grátis
        </h2>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={freteGratisAtivo}
            onChange={(e) => setFreteGratisAtivo(e.target.checked)}
            className="h-4 w-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            Oferecer frete grátis acima de um valor
          </span>
        </label>

        <div className="mt-3">
          <label
            htmlFor="freteGratisAcimaDe"
            className={`block text-sm text-gray-700 mb-1 ${
              freteGratisAtivo ? "" : "opacity-40"
            }`}
          >
            Valor mínimo do pedido (R$)
          </label>
          <div className="flex items-center gap-2">
            <span className={`text-sm text-gray-500 ${freteGratisAtivo ? "" : "opacity-40"}`}>
              R$
            </span>
            <input
              id="freteGratisAcimaDe"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="500"
              value={freteGratisAcimaDe}
              onChange={(e) => setFreteGratisAcimaDe(e.target.value)}
              disabled={!freteGratisAtivo}
              className={`${inputClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
            Pedidos com subtotal de produtos (preço cheio) igual ou acima desse
            valor têm o frete zerado no checkout. Desligado, nenhum pedido ganha
            frete grátis e a faixa do topo do site some.
          </p>
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
