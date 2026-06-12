"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ } from "@/lib/product-content";

export default function ProductFaq() {
  // Set de índices abertos — permite abrir perguntas independentes nas 2 colunas.
  const [abertos, setAbertos] = useState<Set<number>>(() => new Set([0]));

  function toggle(i: number) {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {FAQ.map((item, i) => {
        const open = abertos.has(i);
        return (
          <div
            key={item.pergunta}
            className="rounded-xl border border-border overflow-hidden h-fit"
          >
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={open}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left min-h-11"
            >
              <span className="font-medium text-primary text-sm">
                {item.pergunta}
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-muted-foreground transition-transform ${
                  open ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
            {open && (
              <p className="px-4 pb-4 -mt-1 text-sm text-muted-foreground leading-relaxed">
                {item.resposta}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
