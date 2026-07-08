"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useCart } from "@/lib/stores/cart";
import { comprarNovamente } from "@/actions/conta";

export default function ComprarNovamenteButton({ numero }: { numero: string }) {
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);

  async function comprar() {
    if (carregando) return;
    setCarregando(true);
    try {
      const res = await comprarNovamente(numero);
      if (!res.ok || res.itens.length === 0) {
        toast.error(
          res.ignorados > 0
            ? "Os itens deste pedido não estão mais disponíveis."
            : "Não foi possível adicionar ao carrinho.",
        );
        setCarregando(false);
        return;
      }
      res.itens.forEach((it) => addItem(it, it.quantidade));
      if (res.ignorados > 0) {
        toast.warning(
          `${res.ignorados} item(ns) fora de estoque ficaram de fora.`,
        );
      }
      toast.success("Adicionado ao carrinho ✓");
      router.push("/carrinho");
    } catch {
      toast.error("Não foi possível adicionar ao carrinho.");
      setCarregando(false);
    }
  }

  return (
    <button
      type="button"
      onClick={comprar}
      disabled={carregando}
      className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-pill bg-secondary text-white font-semibold text-sm hover:brightness-110 disabled:opacity-60 transition-all"
    >
      {carregando ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        <ShoppingCart size={16} aria-hidden="true" />
      )}
      Comprar novamente
    </button>
  );
}
