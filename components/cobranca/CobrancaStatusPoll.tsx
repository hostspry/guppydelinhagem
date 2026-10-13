"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { statusDaCobranca } from "@/actions/cobrancas";

const POLL_MS = 6000;
const POLL_ANALISE_MS = 3000;

/**
 * O cliente volta do Mercado Pago antes do webhook chegar. Enquanto a cobrança
 * segue aberta, consulta o banco de tempos em tempos e recarrega a página quando
 * o pagamento cai. Sem isso ele veria "aguardando" mesmo já tendo pago.
 *
 * Também recarrega quando o último cartão muda de situação: "em análise" que
 * vira recusa pelo webhook precisa aparecer na tela, senão o cliente fica
 * esperando (ou tenta o mesmo cartão de novo sem saber por quê).
 */
export default function CobrancaStatusPoll({
  token,
  cartao,
}: {
  token: string;
  /** Situação do último cartão quando a página foi renderizada. */
  cartao: "EM_ANALISE" | "RECUSADO" | null;
}) {
  const router = useRouter();

  useEffect(() => {
    let ativo = true;
    const id = setInterval(
      async () => {
        try {
          const res = await statusDaCobranca(token);
          if (ativo && (res.pago || res.cartao !== cartao)) {
            clearInterval(id);
            router.refresh();
          }
        } catch {
          // rede instável: tenta no próximo tick
        }
      },
      cartao === "EM_ANALISE" ? POLL_ANALISE_MS : POLL_MS,
    );
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token, cartao, router]);

  return null;
}
