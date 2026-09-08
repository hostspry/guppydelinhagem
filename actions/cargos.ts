"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { cargoSchema } from "@/lib/validations/cargo";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { isPrismaError } from "@/lib/utils/action-result";
import { PERMISSAO_LABEL, ehPermissao, type Permissao } from "@/lib/permissoes";

export type CargoResult =
  | { success: true; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

function revalidar() {
  revalidatePath("/admin/cargos");
  revalidatePath("/admin/equipe");
}

function validar(input: unknown) {
  const parsed = cargoSchema.safeParse(input);
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

/** Nomes legíveis das permissões, para a auditoria não virar lista de slug. */
function rotular(permissoes: string[]): string {
  const nomes = permissoes
    .filter(ehPermissao)
    .map((p) => PERMISSAO_LABEL[p as Permissao]);
  return nomes.length ? nomes.join(", ") : "nenhuma";
}

export async function criarCargo(input: unknown): Promise<CargoResult> {
  const membro = await assertPermissao("equipe.gerenciar");

  const { erro, dados } = validar(input);
  if (erro) return erro;

  const ultimo = await prisma.cargo.findFirst({
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  let id: string;
  try {
    const criado = await prisma.cargo.create({
      data: {
        nome: dados.nome,
        descricao: dados.descricao?.trim() || null,
        permissoes: dados.permissoes,
        segmentosFinanceiros: dados.segmentosFinanceiros,
        ordem: (ultimo?.ordem ?? 0) + 1,
      },
      select: { id: true },
    });
    id = criado.id;
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return {
        success: false,
        error: "Já existe um cargo com esse nome.",
        fieldErrors: { nome: ["Já existe um cargo com esse nome."] },
      };
    }
    console.error("[cargo] criar", e);
    return { success: false, error: "Não foi possível criar o cargo." };
  }

  await auditar(membro, {
    acao: "cargo.criar",
    entidade: "Cargo",
    entidadeId: id,
    descricao: `Criou o cargo ${dados.nome} (${rotular(dados.permissoes)})`,
    depois: { nome: dados.nome, permissoes: dados.permissoes },
  });

  revalidar();
  return { success: true, message: "Cargo criado." };
}

export async function atualizarCargo(
  id: string,
  input: unknown,
): Promise<CargoResult> {
  const membro = await assertPermissao("equipe.gerenciar");

  const atual = await prisma.cargo.findUnique({
    where: { id },
    select: { nome: true, permissoes: true, protegido: true },
  });
  if (!atual) return { success: false, error: "Cargo não encontrado." };

  const { erro, dados } = validar(input);
  if (erro) return erro;

  // Tirar `equipe.gerenciar` do último cargo que ainda o tem tranca o painel:
  // ninguém mais consegue devolver permissão a ninguém, nem desfazer este
  // clique. A checagem olha se sobra alguém capaz depois da mudança.
  const perdeGestao =
    !atual.protegido &&
    atual.permissoes.includes("equipe.gerenciar") &&
    !dados.permissoes.includes("equipe.gerenciar");
  if (perdeGestao) {
    const sobram = await prisma.user.count({
      where: {
        role: { not: "CUSTOMER" },
        cargo: {
          id: { not: id },
          OR: [{ protegido: true }, { permissoes: { has: "equipe.gerenciar" } }],
        },
      },
    });
    if (sobram === 0) {
      return {
        success: false,
        error:
          "Este é o único cargo que consegue gerenciar a equipe. Dê esse acesso a outro cargo antes de tirar daqui.",
      };
    }
  }

  // O cargo de dono tem tudo por definição. Deixar mexer nas permissões dele
  // abriria a porta para o painel ficar sem ninguém capaz de gerenciar a equipe,
  // e sem ninguém para desfazer. Nome e descrição seguem editáveis.
  const dadosPermissao = atual.protegido
    ? {}
    : {
        permissoes: dados.permissoes,
        segmentosFinanceiros: dados.segmentosFinanceiros,
      };

  try {
    await prisma.cargo.update({
      where: { id },
      data: {
        nome: dados.nome,
        descricao: dados.descricao?.trim() || null,
        ...dadosPermissao,
      },
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return {
        success: false,
        error: "Já existe um cargo com esse nome.",
        fieldErrors: { nome: ["Já existe um cargo com esse nome."] },
      };
    }
    console.error("[cargo] atualizar", e);
    return { success: false, error: "Não foi possível salvar o cargo." };
  }

  await auditar(membro, {
    acao: "cargo.editar",
    entidade: "Cargo",
    entidadeId: id,
    descricao: `Editou o cargo ${dados.nome}`,
    antes: { nome: atual.nome, permissoes: rotular(atual.permissoes) },
    depois: { nome: dados.nome, permissoes: rotular(dados.permissoes) },
  });

  revalidar();
  return {
    success: true,
    message: atual.protegido
      ? "Cargo salvo. As permissões do dono são fixas."
      : "Cargo salvo.",
  };
}

export async function excluirCargo(id: string): Promise<CargoResult> {
  const membro = await assertPermissao("equipe.gerenciar");

  const alvo = await prisma.cargo.findUnique({
    where: { id },
    select: {
      nome: true,
      protegido: true,
      _count: { select: { usuarios: true } },
    },
  });
  if (!alvo) return { success: false, error: "Cargo não encontrado." };

  if (alvo.protegido) {
    return {
      success: false,
      error: "O cargo de dono não pode ser excluído.",
    };
  }
  // Excluir com gente dentro deixaria essas pessoas sem cargo e, portanto, sem
  // permissão nenhuma no próximo clique. Melhor exigir a troca antes.
  if (alvo._count.usuarios > 0) {
    const n = alvo._count.usuarios;
    return {
      success: false,
      error: `${n} pessoa${n > 1 ? "s usam" : " usa"} este cargo. Mude o cargo dessas pessoas antes de excluir.`,
    };
  }

  try {
    await prisma.cargo.delete({ where: { id } });
  } catch (e) {
    console.error("[cargo] excluir", e);
    return { success: false, error: "Não foi possível excluir o cargo." };
  }

  await auditar(membro, {
    acao: "cargo.excluir",
    entidade: "Cargo",
    entidadeId: id,
    descricao: `Excluiu o cargo ${alvo.nome}`,
    antes: { nome: alvo.nome },
  });

  revalidar();
  return { success: true, message: "Cargo excluído." };
}
