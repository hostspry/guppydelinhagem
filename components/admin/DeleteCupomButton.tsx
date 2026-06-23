"use client";

import { useState, useTransition } from "react";
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
import { deleteCupom } from "@/actions/cupons";

type Props = {
  id: string;
  codigo: string;
  qtdPedidos?: number;
};

export function DeleteCupomButton({ id, codigo, qtdPedidos = 0 }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteCupom(id);
      if (result.success) {
        toast.success("Cupom excluído.");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-gray-400 hover:text-[#FF035C] p-1"
        aria-label={`Excluir ${codigo}`}
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{codigo}</strong>.
              {qtdPedidos > 0 && (
                <span className="block mt-2 text-[#FF035C]">
                  Este cupom foi usado em {qtdPedidos} pedido(s). Os pedidos
                  mantêm o registro do código, então o histórico não se perde.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
