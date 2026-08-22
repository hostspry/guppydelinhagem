"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clienteSchema, type ClienteInput } from "@/lib/validations/cliente";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar, diff } from "@/lib/auditoria";
import {
  type ActionResult,
  isPrismaError,
} from "@/lib/utils/action-result";
import { emailAcessoCliente } from "@/lib/emails/acesso";

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
  const membro = await assertPermissao("clientes.editar");

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

  await auditar(membro, {
    acao: "cliente.criar",
    entidade: "Cliente",
    descricao: `Cadastrou o cliente ${parsed.data.nome}`,
    depois: { nome: parsed.data.nome, telefone: parsed.data.telefone },
  });

  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

export async function updateCliente(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const membro = await assertPermissao("clientes.editar");
  const anterior = await prisma.cliente.findUnique({
    where: { id },
    select: { nome: true, telefone: true, email: true, cidade: true, uf: true },
  });

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

  if (anterior) {
    const mudancas = diff({ ...anterior }, { ...parsed.data } as Record<string, unknown>, [
      "nome",
      "telefone",
      "email",
      "cidade",
      "uf",
    ]);
    if (mudancas.mudou) {
      await auditar(membro, {
        acao: "cliente.atualizar",
        entidade: "Cliente",
        entidadeId: id,
        descricao: `Editou o cliente ${parsed.data.nome}`,
        antes: mudancas.antes,
        depois: mudancas.depois,
      });
    }
  }

  revalidatePath("/admin/clientes");
  redirect("/admin/clientes");
}

export async function deleteCliente(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("clientes.excluir");
  const alvo = await prisma.cliente.findUnique({
    where: { id },
    select: { nome: true, telefone: true },
  });

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
  await auditar(membro, {
    acao: "cliente.excluir",
    entidade: "Cliente",
    entidadeId: id,
    descricao: `Excluiu o cliente ${alvo?.nome ?? id}`,
    antes: alvo ? { nome: alvo.nome } : undefined,
  });

  return { success: true, message: "Cliente excluído." };
}

// ── Acesso do cliente ao painel (venda direta) ───────────────────────────────

export type AcessoCriado =
  | {
      ok: true;
      email: string;
      senha: string;
      recriado: boolean;
      /** O e-mail com os dados saiu? false = mandar pelo WhatsApp. */
      enviadoPorEmail: boolean;
    }
  | { ok: false; error: string };

/** Senha temporária: aleatória, não adivinhável, curta o bastante para digitar. */
function senhaProvisoria(): string {
  return randomBytes(6).toString("base64url"); // ~8 caracteres
}

/**
 * Cria (ou renova) o acesso do cliente ao painel /minha-conta.
 *
 * Existe para a venda direta: o cliente que comprou pelo WhatsApp nunca passou
 * pelo cadastro do site, então não tem como acompanhar o pedido sozinho. Aqui a
 * loja cria a conta e entrega a senha.
 *
 * A senha volta EM TEXTO uma única vez, para o admin repassar — não fica salva em
 * lugar nenhum (só o hash) e não entra na auditoria. Nasce com
 * `senhaPrecisaTroca`, então serve para UM login: na entrada o cliente é obrigado
 * a definir a dele, e a senha que circulou no WhatsApp morre ali.
 *
 * Nunca toca conta da EQUIPE: se o e-mail for de um admin, recusa.
 */
export async function criarAcessoCliente(
  clienteId: string,
): Promise<AcessoCriado> {
  const membro = await assertPermissao("clientes.editar");

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nome: true, email: true, userId: true },
  });
  if (!cliente) return { ok: false, error: "Cliente não encontrado." };
  if (!cliente.email) {
    return {
      ok: false,
      error: `${cliente.nome} está sem e-mail no cadastro. O e-mail é o usuário do acesso — preencha antes.`,
    };
  }
  const email = cliente.email.trim().toLowerCase();

  const existente = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, nome: true },
  });
  if (existente && existente.role !== "CUSTOMER") {
    return {
      ok: false,
      error: `Este e-mail é de um acesso da equipe (${existente.nome}). Não dá para transformar em conta de cliente.`,
    };
  }

  const senha = senhaProvisoria();
  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        nome: cliente.nome,
        senhaHash,
        role: "CUSTOMER",
        senhaPrecisaTroca: true,
      },
      // Já existia (comprou pelo site ou entrou com Google): só renova a senha.
      // Não mexe no nome — o cliente pode ter corrigido o dele.
      update: { senhaHash, senhaPrecisaTroca: true },
      select: { id: true },
    });

    // Liga este cliente e todos os homônimos por e-mail: é assim que os pedidos
    // antigos aparecem no painel dele.
    await prisma.cliente.updateMany({
      where: { OR: [{ id: cliente.id }, { email, userId: null }] },
      data: { userId: user.id },
    });
  } catch (e) {
    console.error("[cliente] criar acesso", e);
    return { ok: false, error: "Não foi possível criar o acesso." };
  }

  await auditar(membro, {
    acao: existente ? "cliente.acesso-renovar" : "cliente.acesso-criar",
    entidade: "Cliente",
    entidadeId: cliente.id,
    // A senha NUNCA entra aqui.
    descricao: existente
      ? `Gerou nova senha de acesso para ${cliente.nome}`
      : `Criou acesso ao painel para ${cliente.nome}`,
  });

  // Manda o acesso por e-mail. Se não sair (conta de e-mail desligada, mensagem
  // desligada no painel, servidor fora do ar), a tela mostra as credenciais do
  // mesmo jeito e o WhatsApp continua ali — o acesso já foi criado.
  const enviadoPorEmail = await emailAcessoCliente({
    nome: cliente.nome,
    email,
    senha,
  }).catch((e) => {
    console.error("[cliente] e-mail de acesso", e);
    return false;
  });

  revalidatePath(`/admin/clientes/${cliente.id}/editar`);
  return { ok: true, email, senha, recriado: !!existente, enviadoPorEmail };
}
