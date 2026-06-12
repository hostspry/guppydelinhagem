"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart, selectTotalItens } from "@/lib/stores/cart";

export default function CartIcon() {
  // Guarda de hidratação: o store vem do localStorage (só no client). Mostrar a
  // contagem só após montar evita mismatch SSR (0) × client (persistido).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const total = useCart(selectTotalItens);
  const count = mounted ? total : 0;

  return (
    <Link
      href="/carrinho"
      className="relative text-primary hover:text-accent transition-colors"
      aria-label={`Carrinho de compras${count > 0 ? ` (${count})` : ""}`}
    >
      <ShoppingCart size={24} />
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-secondary text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center leading-none">
          {count}
        </span>
      )}
    </Link>
  );
}
