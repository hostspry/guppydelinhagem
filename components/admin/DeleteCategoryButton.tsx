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
import { deleteCategory } from "@/actions/categories";

type Props = {
  id: string;
  nome: string;
  qtdProdutos: number;
};

export function DeleteCategoryButton({ id, nome, qtdProdutos }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result.success) {
        toast.success("Categoria excluída.");
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
        aria-label={`Excluir ${nome}`}
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{nome}</strong>.
              {qtdProdutos > 0 && (
                <span className="block mt-2 text-[#FF035C]">
                  Atenção: esta categoria tem {qtdProdutos} produto(s)
                  vinculado(s) e não poderá ser excluída.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending || qtdProdutos > 0}
            >
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
