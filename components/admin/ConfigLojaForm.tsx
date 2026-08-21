"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { salvarConfiguracaoLoja } from "@/actions/config";

/** Aparência geral do site: por enquanto, a tarja do topo. */
export function ConfigLojaForm({ inicial }: { inicial: { tarjaAtiva: boolean; tarjaTexto: string | null } }) {
  const [tarjaAtiva, setTarjaAtiva] = useState(inicial.tarjaAtiva);
  const [tarjaTexto, setTarjaTexto] = useState(inicial.tarjaTexto ?? "");
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    // Marca a seção: a action só grava os campos das seções que chegaram.
    fd.set("secao", "loja");
    if (tarjaAtiva) fd.set("tarjaAtiva", "on");
    fd.set("tarjaTexto", tarjaTexto);
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
      {/* ── Tarja promocional do topo ── */}
      <div>
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Tarja promocional (topo do site)
        </h2>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={tarjaAtiva}
            onChange={(e) => setTarjaAtiva(e.target.checked)}
            className="h-4 w-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            Exibir tarja promocional no topo
          </span>
        </label>

        <div className="mt-3">
          <label
            htmlFor="tarjaTexto"
            className={`block text-sm text-gray-700 mb-1 ${
              tarjaAtiva ? "" : "opacity-40"
            }`}
          >
            Texto da tarja
          </label>
          <textarea
            id="tarjaTexto"
            rows={2}
            placeholder="🇧🇷 Brasil em campo! Use o cupom HEXABRASIL e ganhe 50% OFF em todo o plantel."
            value={tarjaTexto}
            onChange={(e) => setTarjaTexto(e.target.value)}
            disabled={!tarjaAtiva}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C] disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
            Faixa fina verde no topo de todas as páginas. Vazio usa o texto de
            exemplo acima. A palavra <strong>HEXABRASIL</strong> aparece destacada
            em amarelo automaticamente.
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
