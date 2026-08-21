"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { salvarConfiguracaoLoja } from "@/actions/config";

const inputClass =
  "w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

/** Desconto do Pix e quais meios de pagamento aparecem no checkout. */
export function ConfigPagamentosForm({ inicial }: { inicial: { descontoPixGlobalPercent: number; pagbankAtivo: boolean } }) {
  const [pct, setPct] = useState(String(inicial.descontoPixGlobalPercent));
  const [pagbankAtivo, setPagbankAtivo] = useState(inicial.pagbankAtivo);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    // Marca a seção: a action só grava os campos das seções que chegaram.
    fd.set("secao", "pagamentos");
    fd.set("descontoPixGlobalPercent", pct);
    if (pagbankAtivo) fd.set("pagbankAtivo", "on");
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

      {/* ── PagBank (segundo meio de pagamento) ── */}
      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          PagBank
        </h2>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={pagbankAtivo}
            onChange={(e) => setPagbankAtivo(e.target.checked)}
            className="h-4 w-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            Oferecer cartão de crédito via PagBank no checkout
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
          Liga o cartão de crédito pelo PagBank como 2º adquirente (para
          recuperar cartão recusado pelo Mercado Pago). Desligado, a opção some
          do checkout. Requer a chave pública do PagBank configurada no servidor.
        </p>
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
