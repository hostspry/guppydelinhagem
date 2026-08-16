"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { limparRastreioAntigo } from "@/actions/rastreio";

const OPCOES = [
  { dias: 90, rotulo: "mais de 90 dias" },
  { dias: 180, rotulo: "mais de 6 meses" },
  { dias: 365, rotulo: "mais de 1 ano" },
];

export function LimpezaRastreio({ pendentes }: { pendentes: number }) {
  const [aberto, setAberto] = useState(false);
  const [dias, setDias] = useState(90);
  const [isPending, startTransition] = useTransition();

  function limpar() {
    startTransition(async () => {
      const r = await limparRastreioAntigo(dias);
      if (r.success) {
        toast.success(r.message ?? "Histórico limpo.");
        setAberto(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
        Limpar histórico antigo
        {pendentes > 0 && (
          <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold rounded-full px-1.5 py-0.5">
            {pendentes}
          </span>
        )}
      </button>

      <AlertDialog open={aberto} onOpenChange={setAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar histórico antigo</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha até onde voltar. O que for apagado não volta, e os números
              do período somem junto. Pedidos, clientes e o caixa não são
              afetados — isto mexe só no histórico de navegação.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            {OPCOES.map((o) => (
              <label
                key={o.dias}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <input
                  type="radio"
                  name="periodo"
                  checked={dias === o.dias}
                  onChange={() => setDias(o.dias)}
                  className="accent-[#FF035C]"
                />
                Apagar registros com {o.rotulo}
              </label>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={limpar} disabled={isPending}>
              {isPending ? "Apagando..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
