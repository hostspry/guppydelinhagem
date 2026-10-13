"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { consultarStatusPedido } from "@/actions/checkout";

const POLL_MS = 3000;

// Na tela de análise: enquanto o cartão está "em análise", consulta o status do
// pedido no banco (atualizado pelo webhook). Quando aprovado (PAGO), avança pra
// página de sucesso; quando o MP recusa depois da análise, vai pra tela de
// pagamento não concluído (antes o cliente ficava aqui esperando para sempre).
// Não limpa o carrinho aqui — só no sucesso confirmado.
export default function AnaliseStatusPoll({
  numero,
  token,
}: {
  numero: string;
  /** Repassado para a página de sucesso mostrar o resumo do pedido. */
  token?: string;
}) {
  const router = useRouter();
  const indo = useRef(false);

  useEffect(() => {
    let ativo = true;
    const id = setInterval(async () => {
      if (indo.current) return;
      try {
        const res = await consultarStatusPedido(numero);
        if (ativo && res?.pago) {
          indo.current = true;
          clearInterval(id);
          router.push(`/pedido/${numero.replace(/^#/, "")}/sucesso${token ? `?t=${token}` : ""}`);
        } else if (ativo && res?.cartaoRecusado) {
          indo.current = true;
          clearInterval(id);
          router.replace(`/pedido/${numero.replace(/^#/, "")}/falha?motivo=cartao`);
        }
      } catch {
        // rede instável — tenta no próximo tick
      }
    }, POLL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [numero, router, token]);

  return null;
}
