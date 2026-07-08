"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Código de rastreio (AWB) em destaque com botão copiar.
export default function CopiarCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível — silencioso (o código está visível de qualquer forma)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <code className="font-mono font-bold text-[#07366A] text-lg bg-white border border-gray-200 rounded-lg px-3 py-1.5">
        {codigo}
      </code>
      <button
        type="button"
        onClick={copiar}
        className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {copiado ? (
          <>
            <Check size={15} className="text-green-600" aria-hidden="true" />
            Copiado
          </>
        ) : (
          <>
            <Copy size={15} aria-hidden="true" />
            Copiar
          </>
        )}
      </button>
    </div>
  );
}
