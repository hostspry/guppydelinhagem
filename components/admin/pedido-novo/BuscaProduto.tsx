"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { ProdutoPedido } from "@/lib/queries/pedidos";

const input =
  "w-full pl-8 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

const normal = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Escolha de produto com busca. A lista de peixes é longa e parecida ("Koi",
 * "Koi Tuxedo", "Koi Red Ear"): rolar um select para achar o certo é onde o
 * item errado entra no pedido.
 */
export function BuscaProduto({
  produtos,
  produtoId,
  onEscolher,
}: {
  produtos: ProdutoPedido[];
  produtoId: string | null;
  onEscolher: (id: string | null) => void;
}) {
  const atual = produtos.find((p) => p.id === produtoId) ?? null;
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const caixa = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const achados = useMemo(() => {
    const partes = normal(termo).split(/\s+/).filter(Boolean);
    const lista = partes.length
      ? produtos.filter((p) => {
          const n = normal(p.nome);
          return partes.every((t) => n.includes(t));
        })
      : produtos;
    return lista.slice(0, 30);
  }, [produtos, termo]);

  function escolher(id: string | null) {
    onEscolher(id);
    setTermo("");
    setAberto(false);
  }

  return (
    <div
      ref={caixa}
      className="relative flex-1"
      onBlur={(e) => {
        if (!caixa.current?.contains(e.relatedTarget as Node)) setAberto(false);
      }}
    >
      <Search
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        value={aberto ? termo : (atual?.nome ?? "")}
        onChange={(e) => {
          setTermo(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAberto(false);
          if (e.key === "Enter" && aberto) {
            e.preventDefault();
            if (achados[0]) escolher(achados[0].id);
          }
        }}
        placeholder={atual ? atual.nome : "Buscar no catálogo ou deixar como avulso"}
        className={input}
        aria-label="Produto"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
      />
      {atual && !aberto && (
        <button
          type="button"
          onClick={() => escolher(null)}
          aria-label="Tirar o produto e deixar avulso"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF035C]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

      {aberto && (
        <ul
          id={listaId}
          role="listbox"
          // Safari não dá foco a botão no clique: sem isto o input perde o foco,
          // a lista fecha e o clique cai no vazio.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm"
        >
          <li>
            <button
              type="button"
              onClick={() => escolher(null)}
              className="w-full text-left px-3 py-2 text-gray-500 hover:bg-gray-50"
            >
              Item avulso (digitar o nome)
            </button>
          </li>
          {achados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => escolher(p.id)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                  p.id === produtoId ? "font-semibold text-[#07366A]" : "text-gray-700"
                }`}
              >
                {p.nome}
                <span className="ml-1.5 text-xs text-gray-400">
                  {p.tipo === "PEIXE" ? "peixe" : p.tipo.toLowerCase()}
                </span>
              </button>
            </li>
          ))}
          {achados.length === 0 && (
            <li className="px-3 py-2 text-gray-400">Nada com esse nome no catálogo.</li>
          )}
        </ul>
      )}
    </div>
  );
}
