"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ } from "@/lib/product-content";

export default function ProductFaq() {
  const [aberto, setAberto] = useState<number | null>(0);

  return (
    <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
      {FAQ.map((item, i) => {
        const open = aberto === i;
        return (
          <div key={item.pergunta}>
            <button
              type="button"
              onClick={() => setAberto(open ? null : i)}
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
