"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
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
import { estornarPedido } from "@/actions/pedidos";
import { formatBRL } from "@/lib/utils/format";

export function EstornarButton({
  orderId,
  valor,
  gatewayLabel = "Mercado Pago",
}: {
  orderId: string;
  valor: number;
  gatewayLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await estornarPedido(orderId);
      if (result.success) {
        toast.success(result.message ?? "Pedido estornado.");
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
        className="inline-flex items-center gap-1.5 rounded-md bg-[#FF035C] px-4 py-2 text-sm font-medium text-white hover:brightness-110 transition-all"
      >
        <RotateCcw className="w-4 h-4" aria-hidden="true" />
        Estornar no {gatewayLabel}
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Estornar {formatBRL(valor)} ao cliente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso devolve <strong>{formatBRL(valor)}</strong> ao meio de
              pagamento do cliente pelo {gatewayLabel} (no cartão, aparece na
              fatura). Os peixes voltam ao estoque. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Estornando..." : "Confirmar estorno"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
