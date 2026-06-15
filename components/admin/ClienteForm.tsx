"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { FormField } from "./FormField";
import { clienteSchema, type ClienteInput } from "@/lib/validations/cliente";
import { createCliente, updateCliente } from "@/actions/clientes";

type ClienteInitial = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  cpfCnpj: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes: string;
};

const EMPTY: Omit<ClienteInitial, "id"> = {
  nome: "",
  telefone: "",
  email: "",
  cpfCnpj: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  observacoes: "",
};

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function ClienteForm({ initialData }: { initialData?: ClienteInitial }) {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<z.input<typeof clienteSchema>, unknown, ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: initialData
      ? { ...EMPTY, ...stripId(initialData) }
      : EMPTY,
  });

  // ViaCEP: ao completar o CEP (8 dígitos), preenche endereço. Degrada bem —
  // CEP inválido (`{erro:true}`) ou falha de rede só não preenchem, sem quebrar.
  async function handleCepBlur() {
    const cep = (getValues("cep") ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.erro) return;
      setValue("logradouro", data.logradouro ?? "", { shouldValidate: true });
      setValue("bairro", data.bairro ?? "", { shouldValidate: true });
      setValue("cidade", data.localidade ?? "", { shouldValidate: true });
      setValue("uf", data.uf ?? "", { shouldValidate: true });
    } catch {
      // rede falhou — segue sem preencher
    }
  }

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value ?? "");
    }

    startTransition(async () => {
      const result = initialData
        ? await updateCliente(initialData.id, formData)
        : await createCliente(formData);

      // Em sucesso a action faz redirect — só chegamos aqui em erro.
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
      {/* ── Dados ── */}
      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
        Dados
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <FormField label="Nome" name="nome" required error={errors.nome?.message}>
          <input id="nome" {...register("nome")} className={inputClass} autoFocus />
        </FormField>
        <FormField
          label="Telefone (WhatsApp)"
          name="telefone"
          error={errors.telefone?.message}
          hint="Só o nome é obrigatório."
        >
          <input
            id="telefone"
            inputMode="tel"
            {...register("telefone")}
            className={inputClass}
            placeholder="(27) 99602-4171"
          />
        </FormField>
        <FormField label="E-mail" name="email" error={errors.email?.message}>
          <input
            id="email"
            type="email"
            {...register("email")}
            className={inputClass}
          />
        </FormField>
        <FormField
          label="CPF / CNPJ"
          name="cpfCnpj"
          error={errors.cpfCnpj?.message}
          hint="Entra na minuta da transportadora."
        >
          <input
            id="cpfCnpj"
            inputMode="numeric"
            {...register("cpfCnpj")}
            className={inputClass}
          />
        </FormField>
      </div>

      {/* ── Endereço ── */}
      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3 mt-4">
        Endereço
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-4">
        <div className="sm:col-span-2">
          <FormField
            label="CEP"
            name="cep"
            error={errors.cep?.message}
            hint="Preenche o endereço automaticamente."
          >
            <input
              id="cep"
              inputMode="numeric"
              {...register("cep", { onBlur: handleCepBlur })}
              className={inputClass}
              placeholder="29201-010"
            />
          </FormField>
        </div>
        <div className="sm:col-span-4">
          <FormField
            label="Logradouro"
            name="logradouro"
            error={errors.logradouro?.message}
          >
            <input
              id="logradouro"
              {...register("logradouro")}
              className={inputClass}
            />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Número" name="numero" error={errors.numero?.message}>
            <input id="numero" {...register("numero")} className={inputClass} />
          </FormField>
        </div>
        <div className="sm:col-span-4">
          <FormField
            label="Complemento"
            name="complemento"
            error={errors.complemento?.message}
          >
            <input
              id="complemento"
              {...register("complemento")}
              className={inputClass}
            />
          </FormField>
        </div>
        <div className="sm:col-span-3">
          <FormField label="Bairro" name="bairro" error={errors.bairro?.message}>
            <input id="bairro" {...register("bairro")} className={inputClass} />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Cidade" name="cidade" error={errors.cidade?.message}>
            <input id="cidade" {...register("cidade")} className={inputClass} />
          </FormField>
        </div>
        <div className="sm:col-span-1">
          <FormField label="UF" name="uf" error={errors.uf?.message}>
            <input
              id="uf"
              maxLength={2}
              {...register("uf")}
              className={`${inputClass} uppercase`}
              placeholder="ES"
            />
          </FormField>
        </div>
      </div>

      {/* ── Observações ── */}
      <FormField
        label="Observações"
        name="observacoes"
        error={errors.observacoes?.message}
      >
        <textarea
          id="observacoes"
          rows={3}
          {...register("observacoes")}
          className={inputClass}
        />
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
              : "Criar cliente"}
        </button>
        <Link
          href="/admin/clientes"
          className="px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function stripId(d: ClienteInitial): Omit<ClienteInitial, "id"> {
  const { id: _id, ...rest } = d;
  void _id;
  return rest;
}
