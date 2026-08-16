"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clienteSchema, type ClienteInput } from "@/lib/validations/cliente";
import { assertPermissao } from "@/lib/permissoes-server";
import {
  type ActionResult,
  isPrismaError,
} from "@/lib/utils/action-result";

const onlyDigits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
const nullify = (s: string | undefined) => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};
const nullifyDigits = (s: string | undefined) => {
  const d = onlyDigits(s);
  return d === "" ? null : d;
};

/** Normaliza para gravar: telefone/cpfCnpj/cep só dígitos, "" → null, uf maiúsc. */
function toClienteData(input: ClienteInput) {
  return {
    nome: input.nome.trim(),
    telefone: nullifyDigits(input.telefone),
    email: nullify(input.email),
    cpfCnpj: nullifyDigits(input.cpfCnpj),
    cep: nullifyDigits(input.cep),
    logradouro: nullify(input.logradouro),
    numero: nullify(input.numero),
    complemento: nullify(input.complemento),
    bairro: nullify(input.bairro),
    cidade: nullify(input.cidade),
    uf: input.uf ? input.uf.trim().toUpperCase() || null : null,
    observacoes: nullify(input.observacoes),
  };
}

function parseFromForm(formData: FormData) {
  return clienteSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone"),
    email: formData.get("email"),
    cpfCnpj: formData.get("cpfCnpj"),
    cep: formData.get("cep"),
    logradouro: formData.get("logradouro"),
    numero: formData.get("numero"),
    complemento: formData.get("complemento"),
    bairro: formData.get("bairro"),
    cidade: formData.get("cidade"),
    uf: formData.get("uf"),
    observacoes: formData.get("observacoes"),
  });
}

export async function createCliente(
  formData: FormData,
): Promise<ActionResult> {
  await assertPermissao("clientes.editar");

  const parsed = parseFromForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.cliente.create({ data: toClienteData(parsed.data) });
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao salvar. Tente novamente." };
  }

  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

export async function updateCliente(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await assertPermissao("clientes.editar");

  const parsed = parseFromForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await prisma.cliente.update({
      where: { id },
      data: toClienteData(parsed.data),
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Cliente não encontrado." };
    }
    console.error(e);
    return { success: false, error: "Erro ao salvar." };
  }

  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

export async function deleteCliente(id: string): Promise<ActionResult> {
  await assertPermissao("clientes.excluir");

  try {
    await prisma.cliente.delete({ where: { id } });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Cliente não encontrado." };
    }
    console.error(e);
    return { success: false, error: "Erro ao excluir." };
  }

  revalidatePath("/admin/clientes");
  return { success: true, message: "Cliente excluído." };
}
