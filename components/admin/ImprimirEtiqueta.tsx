"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { imprimirEtiquetaDoPedido } from "@/actions/etiqueta";

/**
 * Abre o PDF da etiqueta para imprimir.
 *
 * Pede o link ao Melhor Envio na hora do clique, em vez de usar um href salvo:
 * o link público do ME expira, e etiqueta comprada na segunda costuma ser
 * impressa na quinta. Abre em aba nova — o PDF já abre no visualizador do
 * navegador, com o Ctrl+P ali.
 *
 * A aba é aberta ANTES da chamada e só depois recebe a URL: navegador bloqueia
 * window.open que acontece depois de um await, por não ser mais "gesto do
 * usuário".
 */
export function ImprimirEtiqueta({
  orderId,
  className,
  /** Vazio deixa só o ícone (linha da lista de pedidos, onde não cabe texto). */
  rotulo = "Imprimir etiqueta",
}: {
  orderId: string;
  className?: string;
  rotulo?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function imprimir() {
    const aba = window.open("", "_blank", "noopener,noreferrer");
    startTransition(async () => {
      const r = await imprimirEtiquetaDoPedido(orderId);
      if (!r.success) {
        aba?.close();
        toast.error(r.error);
        return;
      }
      if (aba) aba.location.href = r.url;
      else window.location.href = r.url; // bloqueador de pop-up: vai na mesma aba
    });
  }

  return (
    <button
      type="button"
      onClick={imprimir}
      disabled={isPending}
      title="Abre o PDF da etiqueta para imprimir"
      aria-label={rotulo || "Imprimir etiqueta"}
      className={
        className ??
        "inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all disabled:opacity-60"
      }
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <Printer className="w-4 h-4" aria-hidden="true" />
      )}
      {rotulo}
    </button>
  );
}
