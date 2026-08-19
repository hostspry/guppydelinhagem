"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { statusDaCobranca } from "@/actions/cobrancas";

const POLL_MS = 6000;

/**
 * O cliente volta do Mercado Pago antes do webhook chegar. Enquanto a cobrança
 * segue aberta, consulta o banco de tempos em tempos e recarrega a página quando
 * o pagamento cai. Sem isso ele veria "aguardando" mesmo já tendo pago.
 */
export default function CobrancaStatusPoll({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    let ativo = true;
    const id = setInterval(async () => {
      try {
        const pago = await statusDaCobranca(token);
        if (ativo && pago) {
          clearInterval(id);
          router.refresh();
        }
      } catch {
        // rede instável: tenta no próximo tick
      }
    }, POLL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token, router]);

  return null;
}
