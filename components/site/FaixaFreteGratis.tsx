"use client";

import { usePathname } from "next/navigation";
import { Truck } from "lucide-react";

// O frete grátis é só da loja: arremate de leilão sempre paga o frete cotado,
// então a promessa não pode aparecer nas telas de pagamento do leilão.
const TELAS_DE_LEILAO = ["/leilao/", "/minha-conta/leiloes"];

export default function FaixaFreteGratis({ valor }: { valor: string }) {
  const pathname = usePathname();
  if (TELAS_DE_LEILAO.some((tela) => pathname.startsWith(tela))) return null;

  return (
    <div className="hidden md:flex items-center gap-2 text-sm font-light">
      <Truck size={16} />
      <span>Frete Grátis Para Pedidos Acima de {valor}!</span>
    </div>
  );
}
