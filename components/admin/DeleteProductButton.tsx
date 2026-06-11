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
import { deleteProduct } from "@/actions/products";

type Props = {
  id: string;
  nome: string;
  qtdPedidos: number;
  qtdImagens: number;
  qtdVideos: number;
  qtdWaitlist: number;
};

export function DeleteProductButton({
  id,
  nome,
  qtdPedidos,
  qtdImagens,
  qtdVideos,
  qtdWaitlist,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const bloqueado = qtdPedidos > 0;
  const cascata: string[] = [];
  if (qtdImagens > 0) cascata.push(`${qtdImagens} imagem(ns)`);
  if (qtdVideos > 0) cascata.push(`${qtdVideos} vídeo(s)`);
  if (qtdWaitlist > 0) cascata.push(`${qtdWaitlist} inscrição(ões) na lista de espera`);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteProduct(id);
      if (result.success) {
        toast.success("Produto excluído.");
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
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{nome}</strong>.
              {bloqueado && (
                <span className="block mt-2 text-[#FF035C]">
                  Atenção: este produto tem {qtdPedidos} pedido(s) vinculado(s) e
                  não poderá ser excluído (histórico de venda).
                </span>
              )}
              {!bloqueado && cascata.length > 0 && (
                <span className="block mt-2 text-gray-600">
                  Serão removidos junto: {cascata.join(", ")}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending || bloqueado}
            >
              {isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
