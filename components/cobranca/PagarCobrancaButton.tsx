"use client";

import { useState, useTransition } from "react";
import { pagarCobranca } from "@/actions/cobrancas";

/**
 * Abre o pagamento. A preference é criada na hora (valor e descrição saem do
 * banco, nunca do navegador) e o cliente segue para o Mercado Pago, onde escolhe
 * Pix ou cartão. Quem confirma a venda é o webhook.
 */
export default function PagarCobrancaButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function pagar() {
    setErro(null);
    startTransition(async () => {
      const r = await pagarCobranca(token);
      if (r.ok) {
        window.location.href = r.initPoint;
      } else {
        setErro(r.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={pagar}
        disabled={isPending}
        className="w-full bg-[#FF035C] text-white font-semibold py-3.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-60"
      >
        {isPending ? "Abrindo pagamento…" : "Pagar agora"}
      </button>
      <p className="text-xs text-gray-500 text-center mt-3">
        Você escolhe Pix ou cartão na próxima tela, no ambiente do Mercado Pago.
      </p>
      {erro && (
        <p className="text-sm text-[#FF035C] text-center mt-3" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
