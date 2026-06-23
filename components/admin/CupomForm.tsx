"use client";

import { useState, useMemo, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Link from "next/link";
import { FormField } from "./FormField";
import {
  cupomSchema,
  type CupomFormInput,
  type CupomInput,
} from "@/lib/validations/cupom";
import {
  TipoValorCupom,
  EscopoCupom,
  ModoAplicacaoCupom,
} from "@/lib/generated/prisma/enums";
import { createCupom, updateCupom } from "@/actions/cupons";
import type { CupomDetalhe } from "@/lib/queries/cupons";

type Opcao = { id: string; nome: string };

type CupomFormProps = {
  initialData?: CupomDetalhe;
  categorias: Opcao[];
  produtos: Opcao[];
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

const MODO_DESCRICAO: Record<string, string> = {
  AMBOS_VENCE_MAIOR:
    "Vale no Pix e no cartão. No Pix o cliente leva o maior desconto entre o do Pix e o do cupom (não soma).",
  AMBOS_ACUMULA: "Vale nos dois. No Pix soma com o desconto Pix.",
  SO_PIX: "Só no Pix.",
  SO_CARTAO: "Só no cartão.",
};

// Date → "YYYY-MM-DD" para <input type="date">.
function dataParaInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function CupomForm({ initialData, categorias, produtos }: CupomFormProps) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CupomFormInput, unknown, CupomInput>({
    resolver: zodResolver(cupomSchema),
    defaultValues: initialData
      ? {
          codigo: initialData.codigo,
          descricao: initialData.descricao ?? "",
          tipoValor: initialData.tipoValor,
          valor: initialData.valor,
          escopo: initialData.escopo,
          modoAplicacao: initialData.modoAplicacao,
          ativo: initialData.ativo,
          validoDe: dataParaInput(initialData.validoDe),
          validoAte: dataParaInput(initialData.validoAte),
          limiteUsos: initialData.limiteUsos ?? undefined,
          encerraAoEsgotarEstoque: initialData.encerraAoEsgotarEstoque,
          pedidoMinimo: initialData.pedidoMinimo ?? undefined,
          categoriaIds: initialData.categoriaIds,
          produtoIds: initialData.produtoIds,
        }
      : {
          codigo: "",
          descricao: "",
          tipoValor: TipoValorCupom.PERCENTUAL,
          valor: undefined,
          escopo: EscopoCupom.TODOS,
          modoAplicacao: ModoAplicacaoCupom.AMBOS_VENCE_MAIOR,
          ativo: true,
          validoDe: "",
          validoAte: "",
          limiteUsos: undefined,
          encerraAoEsgotarEstoque: false,
          pedidoMinimo: undefined,
          categoriaIds: [],
          produtoIds: [],
        },
  });

  const tipoValor = useWatch({ control, name: "tipoValor" });
  const escopo = useWatch({ control, name: "escopo" });
  const modoAplicacao = useWatch({ control, name: "modoAplicacao" });
  const categoriaIds = useWatch({ control, name: "categoriaIds" }) ?? [];
  const produtoIds = useWatch({ control, name: "produtoIds" }) ?? [];

  const escopoTodos = escopo === "TODOS";

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = initialData
        ? await updateCupom(initialData.id, data)
        : await createCupom(data);

      // Em sucesso a action faz redirect e não retorna. Se chegou aqui, é erro.
      if (result?.success === false) {
        toast.error(result.error);
      }
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl"
    >
      <FormField
        label="Código"
        name="codigo"
        required
        error={errors.codigo?.message}
        hint="O cliente digita este código no carrinho. Vira maiúsculas automaticamente."
      >
        <input
          id="codigo"
          {...register("codigo")}
          className={`${inputClass} font-mono uppercase`}
          placeholder="BEMVINDO10"
          autoFocus={!initialData}
        />
      </FormField>

      <FormField
        label="Descrição"
        name="descricao"
        error={errors.descricao?.message}
        hint="Uso interno, não aparece para o cliente."
      >
        <input
          id="descricao"
          {...register("descricao")}
          className={inputClass}
          placeholder="Ex: cupom de boas-vindas"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Tipo de valor"
          name="tipoValor"
          required
          error={errors.tipoValor?.message}
        >
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="radio"
                value={TipoValorCupom.PERCENTUAL}
                {...register("tipoValor")}
                className="accent-[#FF035C]"
              />
              Percentual (%)
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="radio"
                value={TipoValorCupom.VALOR_FIXO}
                {...register("tipoValor")}
                className="accent-[#FF035C]"
              />
              Valor fixo (R$)
            </label>
          </div>
        </FormField>

        <FormField label="Valor" name="valor" required error={errors.valor?.message}>
          <div className="flex items-center gap-2">
            <input
              id="valor"
              type="number"
              step="0.01"
              min="0"
              {...register("valor")}
              className={inputClass}
              placeholder={tipoValor === "PERCENTUAL" ? "10" : "15,00"}
            />
            <span className="text-sm text-gray-500 shrink-0">
              {tipoValor === "PERCENTUAL" ? "%" : "R$"}
            </span>
          </div>
        </FormField>
      </div>

      <FormField label="Escopo" name="escopo" required error={errors.escopo?.message}>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <input
              type="radio"
              value={EscopoCupom.TODOS}
              {...register("escopo")}
              className="accent-[#FF035C]"
            />
            Todos os produtos
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <input
              type="radio"
              value={EscopoCupom.CATEGORIAS}
              {...register("escopo")}
              className="accent-[#FF035C]"
            />
            Categorias específicas
          </label>
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <input
              type="radio"
              value={EscopoCupom.PRODUTOS}
              {...register("escopo")}
              className="accent-[#FF035C]"
            />
            Produtos específicos
          </label>
        </div>
      </FormField>

      {escopo === "CATEGORIAS" && (
        <MultiSelect
          label="Categorias"
          opcoes={categorias}
          selecionados={categoriaIds}
          onChange={(ids) =>
            setValue("categoriaIds", ids, { shouldValidate: true })
          }
          error={errors.categoriaIds?.message}
          vazio="Nenhuma categoria cadastrada."
        />
      )}

      {escopo === "PRODUTOS" && (
        <MultiSelect
          label="Produtos"
          opcoes={produtos}
          selecionados={produtoIds}
          onChange={(ids) =>
            setValue("produtoIds", ids, { shouldValidate: true })
          }
          error={errors.produtoIds?.message}
          vazio="Nenhum produto cadastrado."
        />
      )}

      <FormField
        label="Modo de aplicação"
        name="modoAplicacao"
        required
        error={errors.modoAplicacao?.message}
        hint={MODO_DESCRICAO[modoAplicacao ?? "AMBOS_VENCE_MAIOR"]}
      >
        <select
          id="modoAplicacao"
          {...register("modoAplicacao")}
          className={inputClass}
        >
          <option value={ModoAplicacaoCupom.AMBOS_VENCE_MAIOR}>
            Vale nos dois, no Pix usa o maior desconto
          </option>
          <option value={ModoAplicacaoCupom.AMBOS_ACUMULA}>
            Vale nos dois, no Pix soma os descontos
          </option>
          <option value={ModoAplicacaoCupom.SO_PIX}>Só no Pix</option>
          <option value={ModoAplicacaoCupom.SO_CARTAO}>Só no cartão</option>
        </select>
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Válido de"
          name="validoDe"
          error={errors.validoDe?.message}
          hint="Deixe em branco para valer desde já."
        >
          <input
            id="validoDe"
            type="date"
            {...register("validoDe")}
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Válido até"
          name="validoAte"
          error={errors.validoAte?.message}
          hint="Deixe em branco para não expirar."
        >
          <input
            id="validoAte"
            type="date"
            {...register("validoAte")}
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Limite de usos"
          name="limiteUsos"
          error={errors.limiteUsos?.message}
          hint="Deixe em branco para usos ilimitados."
        >
          <input
            id="limiteUsos"
            type="number"
            min="1"
            step="1"
            {...register("limiteUsos")}
            className={inputClass}
            placeholder="Ilimitado"
          />
        </FormField>

        <FormField
          label="Pedido mínimo"
          name="pedidoMinimo"
          error={errors.pedidoMinimo?.message}
          hint="Valor mínimo do pedido para o cupom valer (R$). Opcional."
        >
          <div className="flex items-center gap-2">
            <input
              id="pedidoMinimo"
              type="number"
              min="0"
              step="0.01"
              {...register("pedidoMinimo")}
              className={inputClass}
              placeholder="Sem mínimo"
            />
            <span className="text-sm text-gray-500 shrink-0">R$</span>
          </div>
        </FormField>
      </div>

      <FormField
        label="Encerramento por estoque"
        name="encerraAoEsgotarEstoque"
        error={errors.encerraAoEsgotarEstoque?.message}
      >
        <label
          className={`flex items-center gap-2 text-sm ${
            escopoTodos ? "text-gray-400" : "text-gray-700"
          }`}
        >
          <input
            type="checkbox"
            {...register("encerraAoEsgotarEstoque")}
            disabled={escopoTodos}
            className="accent-[#FF035C]"
          />
          Encerrar o cupom quando os itens do escopo esgotarem
        </label>
        {escopoTodos && (
          <p className="text-xs text-gray-400 mt-1">
            Disponível apenas para cupons de categorias ou produtos.
          </p>
        )}
      </FormField>

      <FormField label="Ativo" name="ativo" error={errors.ativo?.message}>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            {...register("ativo")}
            className="accent-[#FF035C]"
          />
          Cupom ativo (clientes podem usar)
        </label>
      </FormField>

      <div className="flex gap-2 mt-6">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending
            ? "Salvando..."
            : initialData
              ? "Salvar alterações"
              : "Criar cupom"}
        </button>
        <Link
          href="/admin/cupons"
          className="px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

// Lista de checkboxes com busca client-side. O catálogo é pequeno, então filtrar
// em memória é suficiente.
function MultiSelect({
  label,
  opcoes,
  selecionados,
  onChange,
  error,
  vazio,
}: {
  label: string;
  opcoes: Opcao[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  vazio: string;
}) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return opcoes;
    return opcoes.filter((o) => o.nome.toLowerCase().includes(q));
  }, [busca, opcoes]);

  function toggle(id: string) {
    if (selecionados.includes(id)) {
      onChange(selecionados.filter((x) => x !== id));
    } else {
      onChange([...selecionados, id]);
    }
  }

  return (
    <div className="mb-4">
      <div className="block text-xs font-medium text-[#07366A] mb-1">
        {label}
        <span className="text-[#FF035C] ml-0.5">*</span>
        <span className="text-gray-400 font-normal ml-2">
          {selecionados.length} selecionado(s)
        </span>
      </div>

      {opcoes.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">{vazio}</p>
      ) : (
        <>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo nome..."
            className={`${inputClass} mb-2`}
          />
          <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            {filtradas.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-2">
                Nada encontrado.
              </p>
            ) : (
              filtradas.map((o) => (
                <label
                  key={o.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selecionados.includes(o.id)}
                    onChange={() => toggle(o.id)}
                    className="accent-[#FF035C]"
                  />
                  {o.nome}
                </label>
              ))
            )}
          </div>
        </>
      )}

      {error && <p className="text-xs text-[#FF035C] mt-1">{error}</p>}
    </div>
  );
}
