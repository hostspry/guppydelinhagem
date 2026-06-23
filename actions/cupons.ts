"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cupomSchema } from "@/lib/validations/cupom";
import {
  type ActionResult,
  assertAuthorized,
  isPrismaError,
} from "@/lib/utils/action-result";

// <input type="date"> → Date. Início do dia para validoDe; fim do dia para
// validoAte (o cupom vale o dia inteiro da data final).
const inicioDoDia = (s?: string) => (s ? new Date(`${s}T00:00:00`) : null);
const fimDoDia = (s?: string) => (s ? new Date(`${s}T23:59:59.999`) : null);

/** Monta os dados comuns de create/update a partir do input validado. */
function montarDados(d: ReturnType<typeof cupomSchema.parse>) {
  return {
    codigo: d.codigo,
    descricao: d.descricao?.trim() || null,
    tipoValor: d.tipoValor,
    valor: d.valor,
    escopo: d.escopo,
    modoAplicacao: d.modoAplicacao,
    ativo: d.ativo,
    validoDe: inicioDoDia(d.validoDe),
    validoAte: fimDoDia(d.validoAte),
    limiteUsos: d.limiteUsos ?? null,
    encerraAoEsgotarEstoque: d.encerraAoEsgotarEstoque,
    pedidoMinimo: d.pedidoMinimo ?? null,
  };
}

// Relações M:N por escopo: só conecta a relação do escopo escolhido; a outra fica
// vazia. `connect` no create; `set` no update (substitui/limpa o que não se usa).
function relacoesConnect(d: ReturnType<typeof cupomSchema.parse>) {
  return {
    categorias:
      d.escopo === "CATEGORIAS"
        ? { connect: d.categoriaIds.map((id) => ({ id })) }
        : undefined,
    produtos:
      d.escopo === "PRODUTOS"
        ? { connect: d.produtoIds.map((id) => ({ id })) }
        : undefined,
  };
}

function relacoesSet(d: ReturnType<typeof cupomSchema.parse>) {
  return {
    categorias: {
      set: d.escopo === "CATEGORIAS" ? d.categoriaIds.map((id) => ({ id })) : [],
    },
    produtos: {
      set: d.escopo === "PRODUTOS" ? d.produtoIds.map((id) => ({ id })) : [],
    },
  };
}

export async function createCupom(input: unknown): Promise<ActionResult> {
  await assertAuthorized();

  const parsed = cupomSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos do formulário.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  try {
    await prisma.cupomDesconto.create({
      data: { ...montarDados(d), ...relacoesConnect(d) },
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return { success: false, error: "Já existe um cupom com esse código." };
    }
    console.error("[cupom] criar", e);
    return { success: false, error: "Não foi possível criar o cupom." };
  }

  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function updateCupom(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  await assertAuthorized();

  const parsed = cupomSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos do formulário.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  try {
    await prisma.cupomDesconto.update({
      where: { id },
      data: { ...montarDados(d), ...relacoesSet(d) },
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return { success: false, error: "Já existe um cupom com esse código." };
    }
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Cupom não encontrado." };
    }
    console.error("[cupom] atualizar", e);
    return { success: false, error: "Não foi possível salvar o cupom." };
  }

  revalidatePath("/admin/cupons");
  redirect("/admin/cupons");
}

export async function deleteCupom(id: string): Promise<ActionResult> {
  await assertAuthorized();

  try {
    // Pedidos que usaram o cupom mantêm o snapshot cupomCodigo (FK = SetNull).
    await prisma.cupomDesconto.delete({ where: { id } });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Cupom não encontrado." };
    }
    console.error("[cupom] excluir", e);
    return { success: false, error: "Não foi possível excluir o cupom." };
  }

  revalidatePath("/admin/cupons");
  return { success: true, message: "Cupom excluído." };
}

export async function toggleCupomAtivo(id: string): Promise<ActionResult> {
  await assertAuthorized();

  try {
    const atual = await prisma.cupomDesconto.findUnique({
      where: { id },
      select: { ativo: true },
    });
    if (!atual) return { success: false, error: "Cupom não encontrado." };
    await prisma.cupomDesconto.update({
      where: { id },
      data: { ativo: !atual.ativo },
    });
  } catch (e) {
    console.error("[cupom] toggle ativo", e);
    return { success: false, error: "Não foi possível atualizar o cupom." };
  }

  revalidatePath("/admin/cupons");
  return { success: true };
}
