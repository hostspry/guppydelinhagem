"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import Link from "next/link";
import { FormField } from "./FormField";
import {
  categorySchema,
  type CategoryInput,
} from "@/lib/validations/category";
import { slugify } from "@/lib/utils/slug";
import { createCategory, updateCategory } from "@/actions/categories";

type CategoryFormProps = {
  initialData?: {
    id: string;
    nome: string;
    slug: string;
    ordem: number;
  };
  defaultOrdem?: number;
};

export function CategoryForm({
  initialData,
  defaultOrdem = 0,
}: CategoryFormProps) {
  const [isPending, startTransition] = useTransition();
  // Em edit, considera slug já editado (não auto-substitui ao digitar nome)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!initialData);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: initialData ?? {
      nome: "",
      slug: "",
      ordem: defaultOrdem,
    },
  });

  function handleNomeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const novoNome = e.target.value;
    setValue("nome", novoNome, { shouldValidate: true });
    if (!slugManuallyEdited) {
      setValue("slug", slugify(novoNome), { shouldValidate: true });
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugManuallyEdited(true);
    setValue("slug", e.target.value, { shouldValidate: true });
  }

  const onSubmit = handleSubmit((data) => {
    const formData = new FormData();
    formData.append("nome", data.nome);
    formData.append("slug", data.slug);
    formData.append("ordem", String(data.ordem));

    startTransition(async () => {
      const result = initialData
        ? await updateCategory(initialData.id, formData)
        : await createCategory(formData);

      // Em success, a action faz redirect — não chegamos aqui.
      // Se chegamos, é erro.
      if (result?.success === false) {
        toast.error(result.error);
      }
    });
  });

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-gray-200 rounded-lg p-5 max-w-lg"
    >
      <FormField label="Nome" name="nome" required error={errors.nome?.message}>
        <input
          id="nome"
          {...register("nome")}
          onChange={handleNomeChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
          placeholder="Ex: Linhagens Exclusivas"
          autoFocus
        />
      </FormField>

      <FormField
        label="Slug"
        name="slug"
        required
        error={errors.slug?.message}
        hint="URL amigável. Gerado automaticamente do nome — pode editar."
      >
        <input
          id="slug"
          {...register("slug")}
          onChange={handleSlugChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
          placeholder="linhagens-exclusivas"
        />
      </FormField>

      <FormField
        label="Ordem"
        name="ordem"
        error={errors.ordem?.message}
        hint="Posição na listagem. Menor = aparece primeiro."
      >
        <input
          id="ordem"
          type="number"
          min="0"
          {...register("ordem")}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
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
              : "Criar categoria"}
        </button>
        <Link
          href="/admin/categorias"
          className="px-5 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-md hover:border-gray-400 transition-all"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
