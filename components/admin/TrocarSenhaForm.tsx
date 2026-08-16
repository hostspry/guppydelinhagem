"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { trocarMinhaSenha } from "@/actions/senha";

type Campos = { atual: string; nova: string; confirmacao: string };

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function TrocarSenhaForm({ obrigatoria }: { obrigatoria: boolean }) {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Campos>({
    defaultValues: { atual: "", nova: "", confirmacao: "" },
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const r = await trocarMinhaSenha(data);
      if (!r.success) {
        toast.error(r.error);
        for (const [campo, msgs] of Object.entries(r.fieldErrors ?? {})) {
          if (msgs?.[0]) setError(campo as keyof Campos, { message: msgs[0] });
        }
        return;
      }
      toast.success("Senha alterada.");
      // Reload de verdade em vez de router.replace: o cache do router client
      // ainda guarda o /admin que redirecionava para cá, e um refresh() logo
      // depois do replace() cancela a navegação. Trocar senha acontece uma vez
      // na vida do acesso — vale a página recarregar limpa.
      window.location.assign("/admin");
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="atual"
          className="block text-xs font-medium text-[#07366A] mb-1"
        >
          {obrigatoria ? "Senha temporária" : "Senha atual"}
        </label>
        <input
          id="atual"
          type="password"
          autoComplete="current-password"
          autoFocus
          {...register("atual")}
          className={inputClass}
        />
        {errors.atual && (
          <p className="text-xs text-[#FF035C] mt-1">{errors.atual.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="nova"
          className="block text-xs font-medium text-[#07366A] mb-1"
        >
          Nova senha
        </label>
        <input
          id="nova"
          type="password"
          autoComplete="new-password"
          {...register("nova")}
          className={inputClass}
        />
        {errors.nova ? (
          <p className="text-xs text-[#FF035C] mt-1">{errors.nova.message}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-1">Mínimo de 8 caracteres.</p>
        )}
      </div>

      <div>
        <label
          htmlFor="confirmacao"
          className="block text-xs font-medium text-[#07366A] mb-1"
        >
          Repita a nova senha
        </label>
        <input
          id="confirmacao"
          type="password"
          autoComplete="new-password"
          {...register("confirmacao")}
          className={inputClass}
        />
        {errors.confirmacao && (
          <p className="text-xs text-[#FF035C] mt-1">
            {errors.confirmacao.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
