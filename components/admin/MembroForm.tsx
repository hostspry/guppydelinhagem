"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormField } from "./FormField";
import { SenhaTemporaria } from "./SenhaTemporaria";
import { membroSchema, type MembroInput } from "@/lib/validations/membro";
import {
  PAPEIS_EQUIPE,
  PAPEL_DESCRICAO,
  PAPEL_LABEL,
  type PapelEquipe,
} from "@/lib/permissoes";
import { criarMembro, atualizarMembro } from "@/actions/equipe";

type MembroInitial = {
  id: string;
  nome: string;
  email: string;
  role: PapelEquipe;
  limiteDescontoPercent: number | null;
  podeCancelarPedido: boolean;
  podeEstornar: boolean;
  limiteValorFinanceiro: number | null;
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function MembroForm({
  initialData,
  souEu,
}: {
  initialData?: MembroInitial;
  souEu?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [criado, setCriado] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof membroSchema>, unknown, MembroInput>({
    resolver: zodResolver(membroSchema),
    defaultValues: initialData
      ? {
          nome: initialData.nome,
          email: initialData.email,
          role: initialData.role,
          limiteDescontoPercent: initialData.limiteDescontoPercent ?? "",
          podeCancelarPedido: initialData.podeCancelarPedido,
          podeEstornar: initialData.podeEstornar,
          limiteValorFinanceiro: initialData.limiteValorFinanceiro ?? "",
        }
      : {
          nome: "",
          email: "",
          role: "EDITOR",
          limiteDescontoPercent: "",
          podeCancelarPedido: false,
          podeEstornar: false,
          limiteValorFinanceiro: "",
        },
  });

  const papel = watch("role") as PapelEquipe;
  const ehDono = papel === "SUPER_ADMIN";
  const vePedidos = papel === "ADMIN" || papel === "SUPER_ADMIN";

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = initialData
        ? await atualizarMembro(initialData.id, data)
        : await criarMembro(data);

      if (!result.success) {
        toast.error(result.error);
        for (const [campo, msgs] of Object.entries(result.fieldErrors ?? {})) {
          if (msgs?.[0]) {
            setError(campo as keyof MembroInput, { message: msgs[0] });
          }
        }
        return;
      }

      if (result.senhaTemporaria) {
        // Fica na própria tela: sair daqui é perder a senha.
        setCriado({
          nome: result.nome ?? data.nome,
          email: data.email,
          senha: result.senhaTemporaria,
        });
        return;
      }

      toast.success(result.message ?? "Salvo.");
      router.push("/admin/equipe");
    });
  });

  if (criado) {
    return (
      <div className="space-y-4">
        <SenhaTemporaria
          nome={criado.nome}
          email={criado.email}
          senha={criado.senha}
        />
        <Link
          href="/admin/equipe"
          className="inline-block px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
        >
          Voltar para a equipe
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl"
    >
      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
        Quem é
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField label="Nome" name="nome" required error={errors.nome?.message}>
          <input id="nome" {...register("nome")} className={inputClass} autoFocus />
        </FormField>
        <FormField
          label="E-mail"
          name="email"
          required
          error={errors.email?.message}
          hint="É com ele que a pessoa entra no painel."
        >
          <input
            id="email"
            type="email"
            {...register("email")}
            className={inputClass}
          />
        </FormField>
      </div>

      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3 mt-4">
        O que pode fazer
      </h2>
      <FormField label="Papel" name="role" required error={errors.role?.message}>
        {/* No próprio acesso o papel vira texto + hidden: um <select disabled>
            não envia valor e faria a validação reclamar de um campo que a
            pessoa nem podia mexer. */}
        {souEu ? (
          <>
            <p className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-sm text-gray-600">
              {PAPEL_LABEL[papel]}
            </p>
            <input type="hidden" {...register("role")} />
          </>
        ) : (
          <select id="role" {...register("role")} className={inputClass}>
            {PAPEIS_EQUIPE.map((p) => (
              <option key={p} value={p}>
                {PAPEL_LABEL[p]}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <p className="text-xs text-gray-500 -mt-2 mb-4">
        {PAPEL_DESCRICAO[papel] ?? ""}
      </p>
      {souEu && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          Este é o seu próprio acesso. O papel não pode ser alterado por você
          mesmo, para ninguém ficar de fora do painel por engano.
        </p>
      )}

      {/* Limites só existem para quem não é dono. */}
      {ehDono ? (
        <p className="text-xs text-gray-500 mb-4">
          Dono não tem limites: cancela, estorna e dá qualquer desconto.
        </p>
      ) : (
        <>
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3 mt-4">
            Limites
          </h2>

          <FormField
            label="Desconto máximo (%)"
            name="limiteDescontoPercent"
            error={errors.limiteDescontoPercent?.message}
            hint="Vale para o desconto do pedido e para cupons. Em branco = sem limite."
          >
            <input
              id="limiteDescontoPercent"
              inputMode="numeric"
              {...register("limiteDescontoPercent")}
              className={inputClass}
              placeholder="10"
            />
          </FormField>

          {vePedidos && (
            <>
              <div className="space-y-2 mb-4">
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    {...register("podeCancelarPedido")}
                    className="mt-0.5 accent-[#FF035C]"
                  />
                  <span>
                    Pode cancelar pedidos
                    <span className="block text-xs text-gray-400">
                      Inclui pedido já pago, que devolve o estoque.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    {...register("podeEstornar")}
                    className="mt-0.5 accent-[#FF035C]"
                  />
                  <span>
                    Pode estornar pagamentos
                    <span className="block text-xs text-gray-400">
                      Devolve o dinheiro do cliente no Mercado Pago ou PagBank.
                    </span>
                  </span>
                </label>
              </div>

              <FormField
                label="Teto em R$ para cancelar pago e estornar"
                name="limiteValorFinanceiro"
                error={errors.limiteValorFinanceiro?.message}
                hint="Acima disso a ação é bloqueada e sobra para você. Em branco = sem teto."
              >
                <input
                  id="limiteValorFinanceiro"
                  inputMode="decimal"
                  {...register("limiteValorFinanceiro")}
                  className={inputClass}
                  placeholder="300"
                />
              </FormField>
            </>
          )}
        </>
      )}

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
              : "Criar acesso"}
        </button>
        <Link
          href="/admin/equipe"
          className="px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
