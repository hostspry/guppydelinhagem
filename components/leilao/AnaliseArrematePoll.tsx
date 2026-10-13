"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { statusCartaoArremate } from "@/actions/leilao-pagamento";

const POLL_MS = 3000;

/**
 * Fica no aviso "pagamento em análise" do leilão. Quando o webhook decide
 * (aprovado ou recusado), recarrega a página: aprovado mostra a confirmação,
 * recusado volta o formulário com o motivo em cima. Antes o aviso ficava parado
 * até o cliente recarregar sozinho, mesmo com o cartão já recusado.
 */
export default function AnaliseArrematePoll({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    let ativo = true;
    const id = setInterval(async () => {
      try {
        const res = await statusCartaoArremate(token);
        if (ativo && (res.pago || !res.emAnalise)) {
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
