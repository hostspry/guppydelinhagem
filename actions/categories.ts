"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validations/category";
import { auth } from "@/lib/auth";

type ActionResult =
  | { success: true; message?: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

async function assertAuthorized() {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado");
  if (session.user.role === "CUSTOMER") throw new Error("Sem permissão");
  return session;
}

function isPrismaError(e: unknown): e is { code: string } {
  return typeof e === "object" && e !== null && "code" in e;
}

export async function createCategory(
  formData: FormData,
): Promise<ActionResult> {
  await assertAuthorized();

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
  await assertAuthorized();

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
  await assertAuthorized();

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
