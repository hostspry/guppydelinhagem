"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { excluirCargo } from "@/actions/cargos";

export function ExcluirCargoButton({
  id,
  nome,
  pessoas,
}: {
  id: string;
  nome: string;
  pessoas: number;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Excluir com gente dentro deixaria essas pessoas sem permissão nenhuma no
  // próximo clique. O servidor barra de qualquer jeito; aqui só evitamos que o
  // botão prometa algo que não vai acontecer.
  const bloqueado = pessoas > 0;

  function confirmar() {
    startTransition(async () => {
      const r = await excluirCargo(id);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Cargo excluído.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-300 rounded-md px-2.5 py-1.5 hover:border-[#FF035C] hover:text-[#FF035C] transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        Excluir
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o cargo {nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              {bloqueado
                ? `${pessoas === 1 ? "1 pessoa usa" : `${pessoas} pessoas usam`} este cargo. Mude o cargo dessas pessoas antes, senão elas ficariam sem permissão nenhuma.`
                : "Ninguém usa este cargo. Ele some do painel e não tem desfazer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmar();
              }}
              disabled={isPending || bloqueado}
              className="bg-[#FF035C] hover:brightness-110 disabled:opacity-60"
            >
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
