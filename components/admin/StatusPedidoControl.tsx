"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { atualizarStatusPedido } from "@/actions/pedidos";
import { STATUS_PEDIDO, TRANSICOES_PEDIDO } from "@/lib/pedido-status";
import type { OrderStatus } from "@/lib/generated/prisma/client";

export function StatusPedidoControl({
  id,
  status,
}: {
  id: string;
  status: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const proximos = TRANSICOES_PEDIDO[status];
  const atual = STATUS_PEDIDO[status];

  function mudar(novo: OrderStatus) {
    startTransition(async () => {
      const result = await atualizarStatusPedido(id, novo);
      if (result.success) {
        toast.success(`Status: ${STATUS_PEDIDO[novo].label}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${atual.badge}`}
      >
        {atual.label}
      </span>

      {proximos.length > 0 && (
        <span className="text-xs text-gray-400">→</span>
      )}

      {proximos.map((novo) => (
        <button
          key={novo}
          type="button"
          onClick={() => mudar(novo)}
          disabled={isPending}
          className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-[#07366A] hover:border-[#FF035C] hover:text-[#FF035C] disabled:opacity-50 transition-colors"
        >
          {STATUS_PEDIDO[novo].label}
        </button>
      ))}
    </div>
  );
}
