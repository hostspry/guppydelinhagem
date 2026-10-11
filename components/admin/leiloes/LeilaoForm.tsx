"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormField } from "@/components/admin/FormField";
import { salvarLeilao } from "@/actions/leiloes";

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

/** Cria (redireciona para o leilão) ou edita os dados do leilão. */
export function LeilaoForm({
  leilao,
  onSalvo,
}: {
  leilao?: {
    id: string;
    nome: string;
    dataLeilao: string; // AAAA-MM-DD
    prazoPagamentoDias: number;
    maxParcelas: number;
    observacoes: string | null;
  };
  onSalvo?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await salvarLeilao(leilao?.id ?? null, fd);
      // Na criação o servidor redireciona; só volta aqui em erro ou edição.
      if (r?.success === false) {
        setErros(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      if (r?.success) {
        toast.success(r.message ?? "Salvo.");
        setErros({});
        router.refresh();
        onSalvo?.();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl">
      <FormField label="Nome do leilão" name="nome" required error={erros.nome?.[0]}>
        <input
          id="nome"
          name="nome"
          defaultValue={leilao?.nome}
          className={input}
          placeholder="Leilão de sexta, 09/10"
        />
      </FormField>

      <div className="grid gap-x-4 sm:grid-cols-3">
        <FormField label="Data do leilão" name="dataLeilao" required error={erros.dataLeilao?.[0]}>
          <input
            id="dataLeilao"
            name="dataLeilao"
            type="date"
            defaultValue={leilao?.dataLeilao}
            className={input}
          />
        </FormField>
        <FormField
          label="Prazo para pagar (dias)"
          name="prazoPagamentoDias"
          error={erros.prazoPagamentoDias?.[0]}
          hint="Contado de quando a cobrança é gerada."
        >
          <input
            id="prazoPagamentoDias"
            name="prazoPagamentoDias"
            type="number"
            min={1}
            max={30}
            defaultValue={leilao?.prazoPagamentoDias ?? 3}
            className={input}
          />
        </FormField>
        <FormField label="Parcelas no cartão (até)" name="maxParcelas" error={erros.maxParcelas?.[0]}>
          <input
            id="maxParcelas"
            name="maxParcelas"
            type="number"
            min={1}
            max={12}
            defaultValue={leilao?.maxParcelas ?? 12}
            className={input}
          />
        </FormField>
      </div>

      <FormField label="Observações internas" name="observacoes" hint="Só a equipe vê.">
        <textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          defaultValue={leilao?.observacoes ?? ""}
          className={input}
        />
      </FormField>

      <button
        type="submit"
        disabled={isPending}
        className="bg-[#FF035C] text-white text-sm font-medium px-5 py-2 rounded-md hover:brightness-110 disabled:opacity-60"
      >
        {isPending ? "Salvando…" : leilao ? "Salvar" : "Criar leilão"}
      </button>
    </form>
  );
}
