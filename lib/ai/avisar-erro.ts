"use client";

import { toast } from "sonner";
import { URL_CREDITOS_GEMINI, ehSemCredito } from "./credito";

/**
 * Mostra o erro de uma função de IA. Se foi falta de crédito, o aviso fica mais
 * tempo na tela e traz o botão que abre a página de compra do Google, em vez de
 * só dizer que acabou.
 */
export function avisarErroIa(mensagem: string) {
  if (!ehSemCredito(mensagem)) {
    toast.error(mensagem);
    return;
  }
  toast.error(mensagem, {
    duration: 20_000,
    action: {
      label: "Adicionar crédito",
      onClick: () => window.open(URL_CREDITOS_GEMINI, "_blank", "noopener,noreferrer"),
    },
  });
}
