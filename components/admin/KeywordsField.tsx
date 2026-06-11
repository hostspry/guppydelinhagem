"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";

/**
 * Palavras-chave como chips removíveis + input para adicionar manualmente.
 * Controlado pelo pai (array de strings). Usado no ProductForm — a IA preenche
 * via onChange; o operador edita à vontade. Ignora duplicatas (case-insensitive).
 */
export function KeywordsField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (keywords: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim();
    if (!t) return;
    if (value.some((k) => k.toLowerCase() === t.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...value, t]);
    setInput("");
  }

  function remove(target: string) {
    onChange(value.filter((k) => k !== target));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.5rem]">
        {value.length === 0 ? (
          <span className="text-xs text-gray-400">
            Nenhuma palavra-chave ainda.
          </span>
        ) : (
          value.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-[#07366A]/10 text-[#07366A] rounded-full text-xs font-medium"
            >
              {k}
              <button
                type="button"
                onClick={() => remove(k)}
                aria-label={`Remover ${k}`}
                className="hover:text-[#FF035C] transition-colors"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </span>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Adicionar palavra-chave e Enter"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Adicionar
        </button>
      </div>
    </div>
  );
}
