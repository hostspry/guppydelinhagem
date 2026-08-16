"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Lock, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import {
  arquivarCategoria,
  criarCategoria,
  renomearCategoria,
} from "@/actions/financeiro";
import type { CategoriaItem } from "@/lib/queries/financeiro";

const inputClass =
  "px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

function Linha({ c }: { c: CategoriaItem }) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(c.nome);
  const [isPending, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      const r = await renomearCategoria(c.id, nome);
      if (r.success) {
        toast.success(r.message ?? "Renomeada.");
        setEditando(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  function alternar() {
    startTransition(async () => {
      const r = await arquivarCategoria(c.id);
      if (r.success) toast.success(r.message ?? "Pronto.");
      else toast.error(r.error);
    });
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      {editando ? (
        <>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className={`${inputClass} flex-1`}
            autoFocus
          />
          <button
            type="button"
            onClick={salvar}
            disabled={isPending}
            className="p-1.5 text-green-600 hover:text-green-700"
            aria-label="Salvar nome"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setNome(c.nome);
              setEditando(false);
            }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            cancelar
          </button>
        </>
      ) : (
        <>
          <span
            className={`flex-1 text-sm ${c.ativa ? "text-[#07366A]" : "text-gray-400 line-through"}`}
          >
            {c.nome}
          </span>
          {c.sistema && (
            <span
              className="inline-flex items-center gap-1 text-[10px] text-gray-400"
              title="Usada automaticamente pelo sistema"
            >
              <Lock className="w-3 h-3" aria-hidden="true" />
              automática
            </span>
          )}
          <span className="text-[11px] text-gray-400 w-20 text-right">
            {c.usos} uso{c.usos === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="p-1.5 text-gray-400 hover:text-[#07366A]"
            aria-label={`Renomear ${c.nome}`}
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={alternar}
            disabled={isPending || c.sistema}
            className="p-1.5 text-gray-400 hover:text-[#FF035C] disabled:opacity-30 disabled:hover:text-gray-400"
            aria-label={c.ativa ? `Desativar ${c.nome}` : `Reativar ${c.nome}`}
            title={
              c.sistema
                ? "Categoria automática do sistema"
                : c.ativa
                  ? c.usos > 0
                    ? "Desativar (o histórico continua)"
                    : "Excluir"
                  : "Reativar"
            }
          >
            {c.ativa ? (
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Undo2 className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </>
      )}
    </div>
  );
}

export function CategoriasAdmin({ categorias }: { categorias: CategoriaItem[] }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"ENTRADA" | "SAIDA">("SAIDA");
  const [isPending, startTransition] = useTransition();

  function criar() {
    if (nome.trim().length < 2) {
      toast.error("Dê um nome à categoria.");
      return;
    }
    startTransition(async () => {
      const r = await criarCategoria({ nome, tipo });
      if (r.success) {
        toast.success(r.message ?? "Criada.");
        setNome("");
      } else {
        toast.error(r.error);
      }
    });
  }

  const grupos = [
    { titulo: "Entradas", itens: categorias.filter((c) => c.tipo === "ENTRADA") },
    { titulo: "Saídas", itens: categorias.filter((c) => c.tipo === "SAIDA") },
    { titulo: "Sem tipo", itens: categorias.filter((c) => c.tipo === null) },
  ].filter((g) => g.itens.length > 0);

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Nova categoria
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Manutenção de filtros"
            className={`${inputClass} flex-1`}
          />
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "ENTRADA" | "SAIDA")}
            className={inputClass}
          >
            <option value="SAIDA">Saída</option>
            <option value="ENTRADA">Entrada</option>
          </select>
          <button
            type="button"
            onClick={criar}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Criar
          </button>
        </div>
      </div>

      {grupos.map((g) => (
        <div
          key={g.titulo}
          className="bg-white border border-gray-200 rounded-lg overflow-hidden"
        >
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wide">
            {g.titulo}
          </div>
          <div className="divide-y divide-gray-100">
            {g.itens.map((c) => (
              <Linha key={c.id} c={c} />
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-gray-500">
        Categoria já usada não é apagada: ela some da lista de escolha, mas os
        lançamentos antigos continuam mostrando o nome dela.
      </p>
    </div>
  );
}
