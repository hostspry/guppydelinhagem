"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cancelarCobranca, reabrirCobranca } from "@/actions/cobrancas";
import type { SituacaoCobranca } from "@/lib/queries/cobrancas";

/**
 * Cancelar fecha o link na hora; reabrir devolve mais 7 dias de validade.
 * Cobrança paga não aparece com nenhum dos dois: dinheiro que entrou se desfaz
 * por estorno, na tela do pedido.
 */
export function CobrancaAcoes({
  id,
  situacao,
}: {
  id: string;
  situacao: SituacaoCobranca;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (situacao === "PAGA") return null;

  function rodar(fn: () => Promise<{ success: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.success) {
        toast.success(r.message ?? "Pronto.");
        router.refresh();
      } else {
        toast.error(r.error ?? "Não deu certo.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {situacao === "ABERTA" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Cancelar esta cobrança? O link para de funcionar.")) return;
            rodar(() => cancelarCobranca(id));
          }}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-60"
        >
          <Ban className="w-4 h-4" aria-hidden="true" />
          Cancelar cobrança
        </button>
      )}

      {(situacao === "EXPIRADA" || situacao === "CANCELADA") && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => rodar(() => reabrirCobranca(id, 7))}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-60"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Reabrir por mais 7 dias
        </button>
      )}
    </div>
  );
}
