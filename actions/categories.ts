"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validations/category";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar, diff } from "@/lib/auditoria";
import {
  type ActionResult,
  isPrismaError,
} from "@/lib/utils/action-result";

export async function createCategory(
  formData: FormData,
): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  const parsed = categorySchema.safeParse({
    nome: formData.get("nome"),
    slug: formData.get("slug"),
    ordem: formData.get("ordem"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.category.create({ data: parsed.data });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return { success: false, error: "Slug já existe. Escolha outro." };
    }
    console.error(e);
    return { success: false, error: "Erro ao salvar. Tente novamente." };
  }

  await auditar(membro, {
    acao: "categoria.criar",
    entidade: "Category",
    descricao: `Criou a categoria ${parsed.data.nome}`,
    depois: { nome: parsed.data.nome, slug: parsed.data.slug },
  });

  revalidatePath("/admin/categorias");
  redirect("/admin/categorias");
}

export async function updateCategory(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");
  const anterior = await prisma.category.findUnique({
    where: { id },
    select: { nome: true, slug: true, ordem: true },
  });

  const parsed = categorySchema.safeParse({
    nome: formData.get("nome"),
    slug: formData.get("slug"),
    ordem: formData.get("ordem"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.category.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (isPrismaError(e)) {
      if (e.code === "P2002") {
        return { success: false, error: "Slug já existe. Escolha outro." };
      }
      if (e.code === "P2025") {
        return { success: false, error: "Categoria não encontrada." };
      }
    }
    console.error(e);
    return { success: false, error: "Erro ao salvar." };
  }

  if (anterior) {
    const mudancas = diff({ ...anterior }, { ...parsed.data });
    if (mudancas.mudou) {
      await auditar(membro, {
        acao: "categoria.atualizar",
        entidade: "Category",
        entidadeId: id,
        descricao: `Editou a categoria ${parsed.data.nome}`,
        antes: mudancas.antes,
        depois: mudancas.depois,
      });
    }
  }

  revalidatePath("/admin/categorias");
  redirect("/admin/categorias");
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.excluir");
  const alvo = await prisma.category.findUnique({
    where: { id },
    select: { nome: true },
  });

  const cat = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { produtos: true } } },
  });

  if (!cat) return { success: false, error: "Categoria não encontrada." };

  if (cat._count.produtos > 0) {
    return {
      success: false,
      error: `Não é possível excluir: ${cat._count.produtos} produto(s) vinculado(s).`,
    };
  }

  try {
    await prisma.category.delete({ where: { id } });
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao excluir." };
  }

  revalidatePath("/admin/categorias");
  await auditar(membro, {
    acao: "categoria.excluir",
    entidade: "Category",
    entidadeId: id,
    descricao: `Excluiu a categoria ${alvo?.nome ?? id}`,
    antes: alvo ? { nome: alvo.nome } : undefined,
  });

  return { success: true, message: "Categoria excluída." };
}
