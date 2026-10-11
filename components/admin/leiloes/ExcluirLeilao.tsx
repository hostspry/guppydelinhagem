"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { excluirLeilao } from "@/actions/leiloes";

/** Só aparece em leilão sem cobranças: depois disso, o histórico fica. */
export function ExcluirLeilao({ id, nome }: { id: string; nome: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Excluir o leilão "${nome}" e todos os lotes lançados nele?`)) return;
        startTransition(async () => {
          const r = await excluirLeilao(id);
          // Sucesso redireciona no servidor.
          if (r && !r.success) toast.error(r.error);
        });
      }}
      className="inline-flex items-center gap-1.5 text-xs text-red-600 px-2 py-1.5 rounded-md hover:bg-red-50 disabled:opacity-60"
    >
      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
      Excluir leilão
    </button>
  );
}
