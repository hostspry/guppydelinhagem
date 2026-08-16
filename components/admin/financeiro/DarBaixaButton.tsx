"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { marcarComoPago } from "@/actions/financeiro";

/** Conta a pagar → dinheiro que saiu, na data em que saiu de fato. */
export function DarBaixaButton({
  id,
  hoje,
  rotulo,
}: {
  id: string;
  hoje: string;
  rotulo: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [isPending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const r = await marcarComoPago(id, data);
      if (r.success) {
        toast.success(r.message ?? "Baixa registrada.");
        setAberto(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FF035C] text-white text-xs font-medium rounded-md hover:brightness-110"
      >
        <Check className="w-3.5 h-3.5" aria-hidden="true" />
        {rotulo}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        className="px-2 py-1 border border-gray-300 rounded text-xs"
        aria-label="Data do pagamento"
      />
      <button
        type="button"
        onClick={confirmar}
        disabled={isPending}
        className="px-3 py-1.5 bg-[#FF035C] text-white text-xs font-medium rounded-md hover:brightness-110 disabled:opacity-50"
      >
        {isPending ? "..." : "Confirmar"}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="text-xs text-gray-500 hover:text-gray-700 px-1"
      >
        cancelar
      </button>
    </div>
  );
}
