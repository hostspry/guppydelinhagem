"use client";

import { useEffect, useRef } from "react";
import { trackPurchase, type AnalyticsItem } from "@/lib/analytics";

// Dispara o evento GA4 `purchase` na página de sucesso (pagamento confirmado),
// uma única vez por número de pedido (dedup no helper). Client component pra a
// página de sucesso seguir sendo Server Component. Sem dado pessoal.
export default function PurchaseTracker({
  numero,
  value,
  shipping,
  items,
}: {
  numero: string;
  value: number;
  shipping: number;
  items: AnalyticsItem[];
}) {
  const disparado = useRef(false);
  useEffect(() => {
    if (disparado.current) return;
    disparado.current = true;
    trackPurchase({ transactionId: numero, value, shipping, items });
  }, [numero, value, shipping, items]);
  return null;
}
