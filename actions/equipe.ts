"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { membroSchema, type MembroInput } from "@/lib/validations/membro";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar, diff } from "@/lib/auditoria";
import { isPrismaError } from "@/lib/utils/action-result";

export type MembroResult =
  | { success: true; message?: string; senhaTemporaria?: string; nome?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Senha temporária de 12 caracteres. base64url não tem caractere ambíguo de
 * pontuação, o que importa quando alguém vai ditar isso no WhatsApp.
 */
function gerarSenha(): string {
  return randomBytes(9).toString("base64url");
}

/** SUPER_ADMIN ignora limites — grava tudo zerado para não exibir número morto. */
function limitesDoPapel(d: MembroInput) {
  if (d.role === "SUPER_ADMIN") {
    return {
      limiteDescontoPercent: null,
      podeCancelarPedido: true,
      podeEstornar: true,
      limiteValorFinanceiro: null,
    };
  }
  return {
    limiteDescontoPercent: d.limiteDescontoPercent,
    podeCancelarPedido: d.podeCancelarPedido,
    podeEstornar: d.podeEstornar,
    limiteValorFinanceiro: d.limiteValorFinanceiro,
  };
}

function validar(input: unknown) {
  const parsed = membroSchema.safeParse(input);
  if (!parsed.success) {
    return {
      erro: {
        success: false as const,
        error: "Confira os campos do formulário.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }
  return { dados: parsed.data };
}

/** Quantos donos existem — usado para não deixar a loja sem nenhum. */
async function contarSuperAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "SUPER_ADMIN" } });
}

export async function criarMembro(input: unknown): Promise<MembroResult> {
  const eu = await assertPermissao("equipe.gerenciar");

  const { erro, dados } = validar(input);
  if (erro) return erro;
  const d = dados!;

  // O e-mail pode já existir como cliente da loja (comprou antes de entrar no
  // time). Nesse caso promovemos a conta em vez de recusar — mesmo e-mail, mesma
  // pessoa, e o histórico de compras dela continua ligado.
  const existente = await prisma.user.findUnique({
    where: { email: d.email },
    select: { id: true, role: true, nome: true },
  });

  if (existente && existente.role !== "CUSTOMER") {
    return {
      success: false,
      error: `${existente.nome} já faz parte da equipe. Edite o acesso dele na lista.`,
      fieldErrors: { email: ["Este e-mail já é da equipe."] },
    };
  }

  const senha = gerarSenha();
  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    await prisma.user.upsert({
      where: { email: d.email },
      create: {
        email: d.email,
        nome: d.nome,
        senhaHash,
        role: d.role,
        senhaPrecisaTroca: true,
        ...limitesDoPapel(d),
      },
      update: {
        nome: d.nome,
        senhaHash,
        role: d.role,
        senhaPrecisaTroca: true,
        ...limitesDoPapel(d),
      },
    });
  } catch (e) {
    console.error("[equipe] criar", e);
    return { success: false, error: "Não foi possível criar o acesso." };
  }

  await auditar(eu, {
    acao: "equipe.criar",
    entidade: "User",
    descricao: `Deu acesso ao painel para ${d.nome} (${d.email}) como ${d.role}`,
    depois: {
      nome: d.nome,
      email: d.email,
      role: d.role,
      ...limitesDoPapel(d),
    },
  });

  revalidatePath("/admin/equipe");
  return { success: true, senhaTemporaria: senha, nome: d.nome };
}

export async function atualizarMembro(
  id: string,
  input: unknown,
): Promise<MembroResult> {
  const eu = await assertPermissao("equipe.gerenciar");

  const { erro, dados } = validar(input);
  if (erro) return erro;
  const d = dados!;

  const alvo = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true },
  });
  if (!alvo) return { success: false, error: "Membro não encontrado." };
  if (alvo.role === "CUSTOMER") {
    return { success: false, error: "Esta conta não é da equipe." };
  }

  // Mudar o próprio papel é como serrar o galho em que se está sentado: se o
  // dono se rebaixa a EDITOR, ninguém mais entra na tela de equipe.
  if (alvo.id === eu.id && d.role !== alvo.role) {
    return {
      success: false,
      error: "Você não pode mudar o seu próprio papel. Peça a outro dono.",
    };
  }

  // A loja precisa de pelo menos um dono para configurações e equipe.
  if (alvo.role === "SUPER_ADMIN" && d.role !== "SUPER_ADMIN") {
    if ((await contarSuperAdmins()) <= 1) {
      return {
        success: false,
        error:
          "Este é o único dono da loja. Promova outra pessoa a dono antes de rebaixar esta.",
      };
    }
  }

  try {
    await prisma.user.update({
      where: { id },
      data: { nome: d.nome, email: d.email, role: d.role, ...limitesDoPapel(d) },
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return {
        success: false,
        error: "Já existe uma conta com esse e-mail.",
        fieldErrors: { email: ["E-mail já usado."] },
      };
    }
    console.error("[equipe] atualizar", e);
    return { success: false, error: "Não foi possível salvar as alterações." };
  }

  const mudancas = diff(
    { nome: alvo.email, role: alvo.role },
    { nome: d.nome, role: d.role },
  );
  await auditar(eu, {
    acao: "equipe.atualizar",
    entidade: "User",
    entidadeId: id,
    descricao: `Alterou o acesso de ${d.nome}${
      alvo.role !== d.role ? ` (${alvo.role} → ${d.role})` : ""
    }`,
    antes: { role: alvo.role, email: alvo.email },
    depois: { role: d.role, email: d.email, ...limitesDoPapel(d) },
  });
  void mudancas;

  revalidatePath("/admin/equipe");
  return { success: true, message: "Acesso atualizado." };
}

/** Nova senha temporária (esqueceu a senha, ou vazou). Mostrada uma vez na tela. */
export async function resetarSenhaMembro(id: string): Promise<MembroResult> {
  const eu = await assertPermissao("equipe.gerenciar");

  const alvo = await prisma.user.findUnique({
    where: { id },
    select: { role: true, nome: true },
  });
  if (!alvo || alvo.role === "CUSTOMER") {
    return { success: false, error: "Membro não encontrado." };
  }

  const senha = gerarSenha();
  await prisma.user.update({
    where: { id },
    data: { senhaHash: await bcrypt.hash(senha, 10), senhaPrecisaTroca: true },
  });

  await auditar(eu, {
    acao: "equipe.resetar-senha",
    entidade: "User",
    entidadeId: id,
    descricao: `Gerou uma senha nova para ${alvo.nome}`,
  });

  revalidatePath("/admin/equipe");
  return { success: true, senhaTemporaria: senha, nome: alvo.nome };
}

/**
 * Tira o acesso ao painel sem apagar a pessoa: a conta volta a ser CUSTOMER e
 * perde a senha de admin. Apagar o User levaria junto o histórico de compras
 * dela como cliente — e um dia ela pode voltar ao time.
 */
export async function removerAcesso(id: string): Promise<MembroResult> {
  const eu = await assertPermissao("equipe.gerenciar");

  const alvo = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, nome: true },
  });
  if (!alvo || alvo.role === "CUSTOMER") {
    return { success: false, error: "Membro não encontrado." };
  }

  if (alvo.id === eu.id) {
    return {
      success: false,
      error: "Você não pode remover o seu próprio acesso.",
    };
  }

  if (alvo.role === "SUPER_ADMIN" && (await contarSuperAdmins()) <= 1) {
    return {
      success: false,
      error: "Este é o único dono da loja. Promova outra pessoa antes.",
    };
  }

  await prisma.user.update({
    where: { id },
    data: {
      role: "CUSTOMER",
      senhaHash: null,
      senhaPrecisaTroca: false,
      limiteDescontoPercent: null,
      podeCancelarPedido: false,
      podeEstornar: false,
      limiteValorFinanceiro: null,
    },
  });

  await auditar(eu, {
    acao: "equipe.remover",
    entidade: "User",
    entidadeId: id,
    descricao: `Removeu o acesso de ${alvo.nome}`,
    antes: { role: alvo.role },
    depois: { role: "CUSTOMER" },
  });

  revalidatePath("/admin/equipe");
  return { success: true, message: `${alvo.nome} não tem mais acesso ao painel.` };
}
