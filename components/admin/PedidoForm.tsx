"use client";

import { useTransition } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { FormField } from "./FormField";
import { pedidoSchema, type PedidoInput } from "@/lib/validations/pedido";
import { createPedido, updatePedido } from "@/actions/pedidos";
import { formatBRL } from "@/lib/utils/format";

type FormCliente = { id: string; nome: string };
type FormProduto = { id: string; nome: string; preco: number };

type ItemInicial = {
  produtoId: string | null;
  nomeProduto: string;
  precoUnitario: number;
  quantidade: number;
};

export type PedidoInicial = {
  id: string;
  clienteId: string;
  itens: ItemInicial[];
  frete: number;
  desconto: number;
  formaPagamento: string;
  transportadora: string;
  observacoes: string;
};

const FORMA_PAGAMENTO = [
  { value: "PIX", label: "Pix" },
  { value: "BOLETO", label: "Boleto" },
  { value: "CARTAO", label: "Cartão" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "OUTRO", label: "Outro" },
];
const TRANSPORTADORA = [
  { value: "JADLOG", label: "Jadlog" },
  { value: "GOLLOG", label: "Gollog" },
  { value: "OUTRO", label: "Outro" },
];

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

const ITEM_VAZIO: ItemInicial = {
  produtoId: null,
  nomeProduto: "",
  precoUnitario: 0,
  quantidade: 1,
};

export function PedidoForm({
  clientes,
  produtos,
  initialData,
}: {
  clientes: FormCliente[];
  produtos: FormProduto[];
  initialData?: PedidoInicial;
}) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof pedidoSchema>, unknown, PedidoInput>({
    resolver: zodResolver(pedidoSchema),
    defaultValues: initialData
      ? {
          clienteId: initialData.clienteId,
          itens: initialData.itens,
          frete: initialData.frete,
          desconto: initialData.desconto,
          formaPagamento: initialData.formaPagamento,
          transportadora: initialData.transportadora,
          observacoes: initialData.observacoes,
        }
      : {
          clienteId: "",
          itens: [ITEM_VAZIO],
          frete: 0,
          desconto: 0,
          formaPagamento: "",
          transportadora: "",
          observacoes: "",
        },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "itens" });

  // Totais ao vivo (só visual — o servidor recalcula como fonte de verdade).
  const itens = useWatch({ control, name: "itens" });
  const frete = useWatch({ control, name: "frete" });
  const desconto = useWatch({ control, name: "desconto" });
  const num = (v: unknown) => Number(v) || 0;
  const subtotal = (itens ?? []).reduce(
    (s, it) => s + num(it?.precoUnitario) * num(it?.quantidade),
    0,
  );
  const total = subtotal + num(frete) - num(desconto);

  function escolherProduto(index: number, produtoId: string) {
    if (!produtoId) {
      setValue(`itens.${index}.produtoId`, null);
      return;
    }
    const prod = produtos.find((p) => p.id === produtoId);
    setValue(`itens.${index}.produtoId`, produtoId);
    if (prod) {
      setValue(`itens.${index}.nomeProduto`, prod.nome, {
        shouldValidate: true,
      });
      setValue(`itens.${index}.precoUnitario`, prod.preco, {
        shouldValidate: true,
      });
    }
  }

  const onSubmit = handleSubmit((data) => {
    const fd = new FormData();
    fd.append("clienteId", data.clienteId);
    fd.append("itens", JSON.stringify(data.itens));
    fd.append("frete", String(data.frete));
    fd.append("desconto", String(data.desconto));
    fd.append("formaPagamento", data.formaPagamento ?? "");
    fd.append("transportadora", data.transportadora ?? "");
    fd.append("observacoes", data.observacoes ?? "");

    startTransition(async () => {
      const result = initialData
        ? await updatePedido(initialData.id, fd)
        : await createPedido(fd);
      if (result?.success === false) toast.error(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5 max-w-3xl">
      {/* ── Cliente ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <FormField
          label="Cliente"
          name="clienteId"
          required
          error={errors.clienteId?.message}
          hint="Cadastre o cliente em Clientes se ainda não existir."
        >
          <select id="clienteId" {...register("clienteId")} className={input}>
            <option value="">Selecione…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {/* ── Itens ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
            Itens
          </h2>
          <button
            type="button"
            onClick={() => append(ITEM_VAZIO)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#FF035C] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Adicionar item
          </button>
        </div>

        {typeof errors.itens?.message === "string" && (
          <p className="text-xs text-[#FF035C] mb-2">{errors.itens.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, i) => {
            const itemErr = errors.itens?.[i];
            return (
              <div
                key={field.id}
                className="grid grid-cols-12 gap-2 items-start border-b border-gray-100 pb-3"
              >
                {/* Produto (catálogo) ou avulso */}
                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[10px] text-gray-400 mb-1">
                    Produto
                  </label>
                  <select
                    value={(itens?.[i]?.produtoId as string) ?? ""}
                    onChange={(e) => escolherProduto(i, e.target.value)}
                    className={input}
                  >
                    <option value="">— Avulso (digitar) —</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nome (snapshot, editável) */}
                <div className="col-span-12 sm:col-span-4">
                  <label className="block text-[10px] text-gray-400 mb-1">
                    Nome no pedido
                  </label>
                  <input
                    {...register(`itens.${i}.nomeProduto`)}
                    className={input}
                    placeholder="Ex: Guppy Koi Tuxedo (trio)"
                  />
                  {itemErr?.nomeProduto?.message && (
                    <p className="text-[10px] text-[#FF035C] mt-0.5">
                      {itemErr.nomeProduto.message}
                    </p>
                  )}
                </div>

                {/* Preço */}
                <div className="col-span-5 sm:col-span-2">
                  <label className="block text-[10px] text-gray-400 mb-1">
                    Preço (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register(`itens.${i}.precoUnitario`)}
                    className={input}
                  />
                  {itemErr?.precoUnitario?.message && (
                    <p className="text-[10px] text-[#FF035C] mt-0.5">
                      {itemErr.precoUnitario.message}
                    </p>
                  )}
                </div>

                {/* Quantidade */}
                <div className="col-span-5 sm:col-span-1">
                  <label className="block text-[10px] text-gray-400 mb-1">
                    Qtd
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    {...register(`itens.${i}.quantidade`)}
                    className={input}
                  />
                </div>

                {/* Remover */}
                <div className="col-span-2 sm:col-span-1 flex items-end h-full justify-end">
                  <button
                    type="button"
                    onClick={() => (fields.length > 1 ? remove(i) : null)}
                    disabled={fields.length <= 1}
                    aria-label="Remover item"
                    className="text-gray-400 hover:text-[#FF035C] disabled:opacity-30 p-2"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Subtotal da linha */}
                <div className="col-span-12 text-right text-xs text-gray-500">
                  Subtotal:{" "}
                  <span className="font-medium text-[#07366A]">
                    {formatBRL(
                      num(itens?.[i]?.precoUnitario) *
                        num(itens?.[i]?.quantidade),
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Frete / desconto / pagamento / transporte ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <FormField label="Frete (R$)" name="frete" error={errors.frete?.message}>
            <input
              id="frete"
              type="number"
              step="0.01"
              min="0"
              {...register("frete")}
              className={input}
            />
          </FormField>
          <FormField
            label="Desconto (R$)"
            name="desconto"
            error={errors.desconto?.message}
          >
            <input
              id="desconto"
              type="number"
              step="0.01"
              min="0"
              {...register("desconto")}
              className={input}
            />
          </FormField>
          <FormField label="Forma de pagamento" name="formaPagamento">
            <select
              id="formaPagamento"
              {...register("formaPagamento")}
              className={input}
            >
              <option value="">—</option>
              {FORMA_PAGAMENTO.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Transportadora" name="transportadora">
            <select
              id="transportadora"
              {...register("transportadora")}
              className={input}
            >
              <option value="">—</option>
              {TRANSPORTADORA.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Observações" name="observacoes">
          <textarea
            id="observacoes"
            rows={3}
            {...register("observacoes")}
            className={input}
          />
        </FormField>

        {/* Totais (visual; servidor recalcula) */}
        <div className="mt-2 border-t border-gray-100 pt-3 text-sm space-y-1 max-w-xs ml-auto">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Frete</span>
            <span>{formatBRL(num(frete))}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Desconto</span>
            <span>− {formatBRL(num(desconto))}</span>
          </div>
          <div className="flex justify-between font-semibold text-[#07366A] text-base">
            <span>Total</span>
            <span>{formatBRL(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending
            ? "Salvando..."
            : initialData
              ? "Salvar alterações"
              : "Criar pedido"}
        </button>
        <Link
          href={
            initialData ? `/admin/pedidos/${initialData.id}` : "/admin/pedidos"
          }
          className="px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
