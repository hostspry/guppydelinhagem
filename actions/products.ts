"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validations/product";
import {
  type ActionResult,
  assertAuthorized,
  isPrismaError,
} from "@/lib/utils/action-result";

function parseForm(formData: FormData) {
  return productSchema.safeParse({
    nome: formData.get("nome"),
    slug: formData.get("slug"),
    descricao: formData.get("descricao"),
    descricaoCurta: formData.get("descricaoCurta") || undefined,
    preco: formData.get("preco"),
    descontoPix: formData.get("descontoPix") || undefined,
    parcelasMax: formData.get("parcelasMax"),
    tipo: formData.get("tipo"),
    estoque: formData.get("estoque"),
    categoryId: formData.get("categoryId"),
    ativo: formData.get("ativo"),
    destaque: formData.get("destaque"),
  });
}

/** Monta o objeto persistível a partir dos dados validados. */
function toData(input: ReturnType<typeof productSchema.parse>) {
  return {
    nome: input.nome,
    slug: input.slug,
    descricao: input.descricao,
    descricaoCurta: input.descricaoCurta ? input.descricaoCurta : null,
    preco: input.preco,
    descontoPix: input.descontoPix ?? null,
    parcelasMax: input.parcelasMax,
    tipo: input.tipo,
    estoque: input.estoque,
    categoryId: input.categoryId,
    ativo: input.ativo,
    destaque: input.destaque,
  };
}

export async function createProduct(formData: FormData): Promise<ActionResult> {
  await assertAuthorized();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.product.create({ data: toData(parsed.data) });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return { success: false, error: "Slug já existe. Escolha outro." };
    }
    console.error(e);
    return { success: false, error: "Erro ao salvar. Tente novamente." };
  }

  revalidatePath("/admin/produtos");
  redirect("/admin/produtos");
}

export async function updateProduct(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await assertAuthorized();

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.product.update({ where: { id }, data: toData(parsed.data) });
  } catch (e) {
    if (isPrismaError(e)) {
      if (e.code === "P2002") {
        return { success: false, error: "Slug já existe. Escolha outro." };
      }
      if (e.code === "P2025") {
        return { success: false, error: "Produto não encontrado." };
      }
    }
    console.error(e);
    return { success: false, error: "Erro ao salvar." };
  }

  revalidatePath("/admin/produtos");
  redirect("/admin/produtos");
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await assertAuthorized();

  const prod = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { orderItems: true } } },
  });

  if (!prod) return { success: false, error: "Produto não encontrado." };

  // Pedidos vinculados impedem exclusão (histórico de venda; relação sem cascade).
  if (prod._count.orderItems > 0) {
    return {
      success: false,
      error: `Não é possível excluir: ${prod._count.orderItems} pedido(s) vinculado(s).`,
    };
  }

  try {
    // Imagens, vídeos e waitlist somem por onDelete: Cascade.
    await prisma.product.delete({ where: { id } });
  } catch (e) {
    // Rede de segurança: FK inesperada (ex: pedido criado entre a checagem e o delete).
    if (isPrismaError(e) && e.code === "P2003") {
      return {
        success: false,
        error: "Não é possível excluir: há registros vinculados a este produto.",
      };
    }
    console.error(e);
    return { success: false, error: "Erro ao excluir." };
  }

  revalidatePath("/admin/produtos");
  return { success: true, message: "Produto excluído." };
}
