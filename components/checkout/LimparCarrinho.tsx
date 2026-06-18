"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/stores/cart";

// Limpa o carrinho ao montar a página de sucesso (pagamento confirmado). Fica
// num client component próprio pra página de sucesso seguir sendo server.
export default function LimparCarrinho() {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
