"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { confirmarVenda, descartarSugestao } from "@/actions/financeiro";
import { moedaBR } from "@/lib/financeiro/periodo";

/**
 * Conferência de uma venda do site.
 *
 * A taxa e a postagem entram aqui porque é o momento em que o dono tem os dois
 * números na mão (o extrato do gateway e a etiqueta). Preenchendo, o caixa mostra
 * o que a venda REALMENTE deixou; deixando em branco, entra só o valor cheio.
 */
export function ConfirmarVenda({
  id,
  descricao,
  valor,
  freteCobrado,
  hoje,
}: {
  id: string;
  descricao: string;
  valor: number;
  freteCobrado: number | null;
  hoje: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [taxa, setTaxa] = useState("");
  const [frete, setFrete] = useState("");
  const [isPending, startTransition] = useTransition();

  const parse = (s: string) => {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const sobra = valor - parse(taxa) - parse(frete);

  function confirmar() {
    startTransition(async () => {
      const r = await confirmarVenda(id, {
        data,
        taxaGateway: taxa,
        custoFrete: frete,
      });
      if (r.success) {
        toast.success(r.message ?? "Confirmado.");
        setAberto(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  function descartar() {
    startTransition(async () => {
      const r = await descartarSugestao(id);
      if (r.success) toast.success(r.message ?? "Descartado.");
      else toast.error(r.error);
    });
  }

  if (!aberto) {
    return (
      <div className="flex gap-1 justify-end">
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FF035C] text-white text-xs font-medium rounded-md hover:brightness-110"
        >
          <Check className="w-3.5 h-3.5" aria-hidden="true" />
          Conferir
        </button>
        <button
          type="button"
          onClick={descartar}
          disabled={isPending}
          className="p-1.5 text-gray-400 hover:text-[#FF035C] disabled:opacity-50"
          aria-label={`Descartar ${descricao}`}
          title="Descartar (não entra no caixa)"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-left">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <label className="block">
          <span className="block text-[11px] font-medium text-[#07366A] mb-1">
            Caiu na conta em
          </span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium text-[#07366A] mb-1">
            Taxa do gateway
          </span>
          <input
            inputMode="decimal"
            value={taxa}
            onChange={(e) => setTaxa(e.target.value)}
            placeholder="opcional"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium text-[#07366A] mb-1">
            Custo da postagem
          </span>
          <input
            inputMode="decimal"
            value={frete}
            onChange={(e) => setFrete(e.target.value)}
            placeholder="opcional"
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
          />
        </label>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Entra {moedaBR.format(valor)} de venda
        {parse(taxa) > 0 || parse(frete) > 0 ? (
          <>
            , saem {moedaBR.format(parse(taxa) + parse(frete))} de custos, sobram{" "}
            <strong className="text-[#07366A]">{moedaBR.format(sobra)}</strong>
          </>
        ) : null}
        .
        {freteCobrado != null && freteCobrado > 0 && (
          <span className="block text-gray-400 mt-0.5">
            O cliente pagou {moedaBR.format(freteCobrado)} de frete neste pedido —
            aqui vai o que a etiqueta custou para você.
          </span>
        )}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmar}
          disabled={isPending}
          className="px-4 py-1.5 bg-[#FF035C] text-white text-xs font-medium rounded-md hover:brightness-110 disabled:opacity-50"
        >
          {isPending ? "Confirmando..." : "Confirmar no caixa"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="px-4 py-1.5 border border-gray-300 text-xs text-gray-700 rounded-md hover:border-gray-400"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
