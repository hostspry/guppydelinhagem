"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  excluirRecorrencia,
  gerarContasDoMes,
  salvarRecorrencia,
} from "@/actions/financeiro";
import type { RecorrenciaItem } from "@/lib/queries/financeiro";
import { moedaBR } from "@/lib/financeiro/periodo";

type Categoria = { id: string; nome: string; tipo: "ENTRADA" | "SAIDA" | null };

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

const VAZIO = {
  id: null as string | null,
  tipo: "SAIDA" as "ENTRADA" | "SAIDA",
  descricao: "",
  valor: "",
  diaVencimento: "10",
  categoriaId: "",
  ativa: true,
};

export function RecorrentesAdmin({
  recorrencias,
  categorias,
  competencia,
}: {
  recorrencias: RecorrenciaItem[];
  categorias: Categoria[];
  competencia: string;
}) {
  const [form, setForm] = useState(VAZIO);
  const [aberto, setAberto] = useState(false);
  const [isPending, startTransition] = useTransition();

  function editar(r: RecorrenciaItem) {
    setForm({
      id: r.id,
      tipo: r.tipo,
      descricao: r.descricao,
      valor: r.valor.toFixed(2).replace(".", ","),
      diaVencimento: String(r.diaVencimento),
      categoriaId: r.categoriaId ?? "",
      ativa: r.ativa,
    });
    setAberto(true);
  }

  function salvar() {
    startTransition(async () => {
      const r = await salvarRecorrencia(form.id, {
        tipo: form.tipo,
        descricao: form.descricao,
        valor: form.valor,
        diaVencimento: form.diaVencimento,
        categoriaId: form.categoriaId,
        ativa: form.ativa,
      });
      if (r.success) {
        toast.success(r.message ?? "Salvo.");
        setForm(VAZIO);
        setAberto(false);
      } else {
        toast.error(r.error);
      }
    });
  }

  function remover(id: string, descricao: string) {
    if (!confirm(`Remover "${descricao}" das contas fixas?`)) return;
    startTransition(async () => {
      const r = await excluirRecorrencia(id);
      if (r.success) toast.success(r.message ?? "Removida.");
      else toast.error(r.error);
    });
  }

  function gerar() {
    startTransition(async () => {
      const r = await gerarContasDoMes(competencia);
      if (r.success) toast.success(r.message ?? "Pronto.");
      else toast.error(r.error);
    });
  }

  const categoriasDoTipo = categorias.filter(
    (c) => c.tipo === null || c.tipo === form.tipo,
  );

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setForm(VAZIO);
            setAberto((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Nova conta fixa
        </button>
        <button
          type="button"
          onClick={gerar}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 disabled:opacity-50"
          title="Cria as contas deste mês a partir das ativas"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Gerar contas do mês
        </button>
      </div>

      {aberto && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
            {form.id ? "Editar conta fixa" : "Nova conta fixa"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <label className="block sm:col-span-2">
              <span className="block text-xs font-medium text-[#07366A] mb-1">
                Descrição
              </span>
              <input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Conta de luz do galpão"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-[#07366A] mb-1">
                Valor previsto (R$)
              </span>
              <input
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder="350,00"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-[#07366A] mb-1">
                Vence todo dia
              </span>
              <input
                inputMode="numeric"
                value={form.diaVencimento}
                onChange={(e) => setForm({ ...form, diaVencimento: e.target.value })}
                className={inputClass}
              />
              <span className="block text-xs text-gray-400 mt-1">
                De 1 a 28, para o dia existir em todo mês.
              </span>
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-[#07366A] mb-1">
                Tipo
              </span>
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo: e.target.value as "ENTRADA" | "SAIDA",
                    categoriaId: "",
                  })
                }
                className={inputClass}
              >
                <option value="SAIDA">Conta a pagar</option>
                <option value="ENTRADA">Recebimento fixo</option>
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-[#07366A] mb-1">
                Categoria
              </span>
              <select
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                className={inputClass}
              >
                <option value="">Sem categoria</option>
                {categoriasDoTipo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
            <input
              type="checkbox"
              checked={form.ativa}
              onChange={(e) => setForm({ ...form, ativa: e.target.checked })}
              className="accent-[#FF035C]"
            />
            Ativa (gera a conta todo mês)
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={isPending}
              className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50"
            >
              {isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(VAZIO);
                setAberto(false);
              }}
              className="px-5 py-2 border border-gray-300 text-sm text-gray-700 rounded-md hover:border-gray-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {recorrencias.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <CalendarClock
            className="w-6 h-6 text-gray-300 mx-auto mb-2"
            aria-hidden="true"
          />
          <p className="text-sm text-gray-500">
            Nenhuma conta fixa ainda. Cadastre luz, água, internet e ração para elas
            aparecerem sozinhas todo mês.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {recorrencias.map((r) => (
            <div key={r.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm ${r.ativa ? "text-[#07366A]" : "text-gray-400"}`}
                >
                  {r.descricao}
                  {!r.ativa && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                      pausada
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  todo dia {r.diaVencimento}
                  {r.categoriaNome && ` · ${r.categoriaNome}`}
                  {r.ultimaCompetencia && ` · gerada em ${r.ultimaCompetencia}`}
                </div>
              </div>
              <div
                className={`text-sm font-medium whitespace-nowrap ${
                  r.tipo === "ENTRADA" ? "text-green-700" : "text-[#FF035C]"
                }`}
              >
                {r.tipo === "ENTRADA" ? "+" : "−"} {moedaBR.format(r.valor)}
              </div>
              <button
                type="button"
                onClick={() => editar(r)}
                className="p-1.5 text-gray-400 hover:text-[#07366A]"
                aria-label={`Editar ${r.descricao}`}
              >
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => remover(r.id, r.descricao)}
                className="p-1.5 text-gray-400 hover:text-[#FF035C]"
                aria-label={`Remover ${r.descricao}`}
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        As contas do mês são geradas automaticamente uma vez por mês. Elas nascem em
        aberto: só entram no caixa quando você der baixa, com o valor real.
      </p>
    </div>
  );
}
