"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validations/category";
import { assertPermissao } from "@/lib/permissoes-server";
import {
  type ActionResult,
  isPrismaError,
} from "@/lib/utils/action-result";

export async function createCategory(
  formData: FormData,
): Promise<ActionResult> {
  await assertPermissao("catalogo.editar");

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

  revalidatePath("/admin/categorias");
  redirect("/admin/categorias");
}

export async function updateCategory(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await assertPermissao("catalogo.editar");

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

  revalidatePath("/admin/categorias");
  redirect("/admin/categorias");
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await assertPermissao("catalogo.excluir");

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
  return { success: true, message: "Categoria excluída." };
}
