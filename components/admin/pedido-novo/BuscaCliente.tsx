"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { buscarClientes, type ClienteCompleto } from "@/actions/venda-whatsapp";

/**
 * Busca manual de cliente já cadastrado. Serve para a venda sem dados colados
 * (cliente antigo que só pediu de novo) e para quando o CPF da conversa não
 * bateu com o cadastro.
 */
export function BuscaCliente({ onEscolher }: { onEscolher: (c: ClienteCompleto) => void }) {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<ClienteCompleto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const ultima = useRef(0);

  useEffect(() => {
    const q = termo.trim();
    // Termo curto não busca; a lista só aparece com 2 letras ou mais.
    if (q.length < 2) return;
    const id = ++ultima.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscarClientes(q);
        // Resposta velha que chegou depois da nova não pode sobrescrever.
        if (id === ultima.current) setAchados(r);
      } finally {
        if (id === ultima.current) setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [termo]);

  return (
    <div
      ref={caixa}
      className="relative mb-4"
      onBlur={(e) => {
        if (!caixa.current?.contains(e.relatedTarget as Node)) setAberto(false);
      }}
    >
      <Search
        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        value={termo}
        onChange={(e) => {
          setTermo(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        placeholder="Buscar cliente cadastrado por nome, telefone ou CPF"
        className="w-full pl-8 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
        aria-label="Buscar cliente"
      />
      {buscando && (
        <Loader2
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin"
          aria-hidden="true"
        />
      )}

      {aberto && termo.trim().length >= 2 && !buscando && (
        <ul
          // Mantém o foco no input: no Safari o clique fecharia a lista antes.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm">
          {achados.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onEscolher(c);
                  setTermo("");
                  setAberto(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50"
              >
                <strong className="text-[#07366A]">{c.nome}</strong>
                <span className="block text-xs text-gray-500">
                  {[c.cidade && `${c.cidade}${c.uf ? `/${c.uf}` : ""}`, c.telefone, `${c.pedidos} pedido(s)`]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
          {achados.length === 0 && (
            <li className="px-3 py-2 text-gray-400">Ninguém cadastrado com isso.</li>
          )}
        </ul>
      )}
    </div>
  );
}
