"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import { criarCargo, atualizarCargo } from "@/actions/cargos";
import {
  GRUPOS_PERMISSAO,
  PERMISSAO_LABEL,
  PERMISSOES_SENSIVEIS,
  SEGMENTO_DESCRICAO,
  SEGMENTO_LABEL,
  SEGMENTOS,
  type Permissao,
} from "@/lib/permissoes";
import type { SegmentoFinanceiro } from "@/lib/generated/prisma/enums";

export type CargoInicial = {
  id: string;
  nome: string;
  descricao: string | null;
  permissoes: Permissao[];
  segmentosFinanceiros: SegmentoFinanceiro[];
  protegido: boolean;
  pessoas: number;
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function CargoForm({ initialData }: { initialData?: CargoInicial }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [permissoes, setPermissoes] = useState<Set<Permissao>>(
    new Set(initialData?.permissoes ?? []),
  );
  const [segmentos, setSegmentos] = useState<Set<SegmentoFinanceiro>>(
    new Set(initialData?.segmentosFinanceiros ?? []),
  );
  const [erroNome, setErroNome] = useState<string | null>(null);

  // O cargo de dono tem tudo por definição: as caixinhas aparecem marcadas e
  // travadas, para a tela contar a verdade em vez de fingir que dá para mexer.
  const travado = initialData?.protegido ?? false;

  function alternar(p: Permissao) {
    setPermissoes((atual) => {
      const novo = new Set(atual);
      if (novo.has(p)) novo.delete(p);
      else novo.add(p);
      return novo;
    });
  }

  function alternarSegmento(s: SegmentoFinanceiro) {
    setSegmentos((atual) => {
      const novo = new Set(atual);
      if (novo.has(s)) novo.delete(s);
      else novo.add(s);
      return novo;
    });
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErroNome(null);
    const payload = {
      nome,
      descricao,
      permissoes: [...permissoes],
      segmentosFinanceiros: [...segmentos],
    };
    startTransition(async () => {
      const r = initialData
        ? await atualizarCargo(initialData.id, payload)
        : await criarCargo(payload);
      if (!r.success) {
        toast.error(r.error);
        if (r.fieldErrors?.nome?.[0]) setErroNome(r.fieldErrors.nome[0]);
        return;
      }
      toast.success(r.message ?? "Salvo.");
      router.push("/admin/cargos");
      router.refresh();
    });
  }

  const marcouSensivel = [...permissoes].some((p) =>
    (PERMISSOES_SENSIVEIS as readonly string[]).includes(p),
  );

  return (
    <form
      onSubmit={salvar}
      className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl"
    >
      <FormField label="Nome do cargo" name="nome" required error={erroNome ?? undefined}>
        <input
          id="nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className={inputClass}
          placeholder="Admin da estufa"
        />
      </FormField>

      <FormField
        label="Descrição"
        name="descricao"
        hint="Aparece na hora de escolher o cargo de alguém. Uma frase basta."
      >
        <input
          id="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className={inputClass}
          placeholder="Cuida dos peixes e do caixa da estufa."
        />
      </FormField>

      {travado && (
        <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Este é o cargo de dono: ele tem todas as permissões e vê o caixa
            inteiro, sempre. É o que garante que ninguém fique trancado para fora
            do painel por um clique errado. Nome e descrição você pode mudar.
          </span>
        </p>
      )}

      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-1 mt-5">
        O que este cargo pode fazer
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        O menu do painel esconde sozinho o que não estiver marcado.
      </p>

      <div className="space-y-4 mb-5">
        {GRUPOS_PERMISSAO.map((grupo) => (
          <fieldset key={grupo.titulo}>
            <legend className="text-xs font-medium text-gray-500 mb-1.5">
              {grupo.titulo}
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {grupo.itens.map((p) => (
                <label
                  key={p}
                  className="flex items-start gap-2 text-sm text-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={travado || permissoes.has(p)}
                    disabled={travado}
                    onChange={() => alternar(p)}
                    className="mt-0.5 accent-[#FF035C] disabled:opacity-60"
                  />
                  <span>{PERMISSAO_LABEL[p]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {marcouSensivel && !travado && (
        <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3 mb-5">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Este cargo mexe em coisa que não tem desfazer (excluir pedido ou
            cliente, mudar configuração, gerenciar a equipe). Quem gerencia a
            equipe também consegue se dar mais permissão depois.
          </span>
        </p>
      )}

      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-1">
        Qual caixa este cargo enxerga
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Sem nada marcado, enxerga o caixa inteiro. Marcando, só o que estiver
        marcado — é assim que a estufa e a loja de produtos ficam separadas.
      </p>
      <div className="space-y-2 mb-6">
        {SEGMENTOS.map((sg) => (
          <label key={sg} className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={travado ? false : segmentos.has(sg)}
              disabled={travado}
              onChange={() => alternarSegmento(sg)}
              className="mt-0.5 accent-[#FF035C] disabled:opacity-60"
            />
            <span>
              {SEGMENTO_LABEL[sg]}
              <span className="block text-xs text-gray-400">
                {SEGMENTO_DESCRICAO[sg]}
              </span>
            </span>
          </label>
        ))}
      </div>

      {initialData && initialData.pessoas > 0 && (
        <p className="text-xs text-gray-500 mb-4">
          {initialData.pessoas === 1
            ? "1 pessoa usa este cargo e sente a mudança no próximo clique dela."
            : `${initialData.pessoas} pessoas usam este cargo e sentem a mudança no próximo clique delas.`}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#FF035C] text-white text-sm font-medium px-5 py-2 rounded-md hover:brightness-110 transition-all disabled:opacity-60"
        >
          {isPending ? "Salvando..." : "Salvar cargo"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/cargos")}
          className="border border-gray-300 text-sm font-medium text-gray-700 px-5 py-2 rounded-md hover:border-gray-400 transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
