"use client";

import { useState, type ReactNode } from "react";

/**
 * Abas da página do produto.
 *
 * Todas ficam montadas depois da primeira visita, só escondidas: trocar para a
 * aba do Mercado Livre no meio de uma edição não pode apagar o que foi digitado
 * no formulário. A aba só monta quando é aberta pela primeira vez, porque a do
 * ML consulta a API deles, e isso não precisa acontecer em toda edição.
 *
 * A aba aberta vai para a URL (?aba=mercado-livre) sem navegar, para o link
 * voltar direto nela.
 */
export function AbasProduto({
  abas,
  inicial,
}: {
  abas: { id: string; rotulo: string; conteudo: ReactNode }[];
  inicial?: string;
}) {
  const primeira = abas.some((a) => a.id === inicial) ? inicial! : abas[0].id;
  const [ativa, setAtiva] = useState(primeira);
  const [visitadas, setVisitadas] = useState<Set<string>>(() => new Set([primeira]));

  function abrir(id: string) {
    setAtiva(id);
    setVisitadas((v) => (v.has(id) ? v : new Set(v).add(id)));
    const url = new URL(window.location.href);
    if (id === abas[0].id) url.searchParams.delete("aba");
    else url.searchParams.set("aba", id);
    window.history.replaceState(null, "", url);
  }

  if (abas.length === 1) return <>{abas[0].conteudo}</>;

  return (
    <div>
      <div
        role="tablist"
        aria-label="Seções do produto"
        className="mb-5 flex gap-1 border-b border-gray-200 overflow-x-auto"
      >
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`aba-${a.id}`}
            aria-selected={ativa === a.id}
            aria-controls={`painel-${a.id}`}
            onClick={() => abrir(a.id)}
            className={`shrink-0 px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
              ativa === a.id
                ? "border-[#FF035C] text-[#07366A]"
                : "border-transparent text-gray-500 hover:text-[#07366A]"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      {abas.map((a) =>
        visitadas.has(a.id) ? (
          <div
            key={a.id}
            role="tabpanel"
            id={`painel-${a.id}`}
            aria-labelledby={`aba-${a.id}`}
            hidden={ativa !== a.id}
          >
            {a.conteudo}
          </div>
        ) : null,
      )}
    </div>
  );
}
