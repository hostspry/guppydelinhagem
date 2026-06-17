"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { toggleProductAtivo, toggleProductDestaque } from "@/actions/products";
import type { ActionResult } from "@/lib/utils/action-result";

// Toggle otimista: atualiza na hora; em erro, reverte + toast. Sincroniza com o
// valor do servidor (revalidate) via ajuste de estado em render (guarda o prop).
function useFlag(
  value: boolean,
  action: (id: string, v: boolean) => Promise<ActionResult>,
  id: string,
) {
  const [on, setOn] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setOn(value);
  }
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const r = await action(id, next);
      if (!r.success) {
        setOn(!next);
        toast.error(r.error);
      }
    });
  }
  return { on, pending, toggle };
}

export function AtivoToggle({ id, value }: { id: string; value: boolean }) {
  const { on, pending, toggle } = useFlag(value, toggleProductAtivo, id);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      disabled={pending}
      aria-label={on ? "Ativo — clique para ocultar da loja" : "Inativo — clique para ativar"}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
        on ? "bg-green-500" : "bg-gray-300"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function DestaqueToggle({ id, value }: { id: string; value: boolean }) {
  const { on, pending, toggle } = useFlag(value, toggleProductDestaque, id);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      disabled={pending}
      aria-label={
        on ? "Em destaque — clique para remover" : "Sem destaque — clique para destacar"
      }
      className="p-1 disabled:opacity-60"
    >
      <Star
        size={18}
        className={on ? "text-accent fill-accent" : "text-gray-300"}
        aria-hidden="true"
      />
    </button>
  );
}
