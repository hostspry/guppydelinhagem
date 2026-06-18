"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { salvarConfiguracaoLoja } from "@/actions/config";

const inputClass =
  "w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function ConfiguracoesForm({
  inicial,
}: {
  inicial: { descontoPixGlobalPercent: number };
}) {
  const [pct, setPct] = useState(String(inicial.descontoPixGlobalPercent));
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("descontoPixGlobalPercent", pct);
    startTransition(async () => {
      const r = await salvarConfiguracaoLoja(fd);
      if (r.success) toast.success(r.message ?? "Salvo.");
      else toast.error(r.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl"
    >
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

      <div className="mt-6">
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
