"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar, diff } from "@/lib/auditoria";
import { heroSlideSchema } from "@/lib/validations/hero";
import type { ActionResult } from "@/lib/utils/action-result";

/**
 * Slides do hero da home.
 *
 * O hero é a primeira coisa que o visitante vê, então toda mudança aqui
 * revalida a home na hora — anúncio de promoção não pode esperar cache.
 */

function revalidarHome() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/hero-slides");
}

export async function criarHeroSlide(input: unknown): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  const parsed = heroSlideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  let novoId = "";
  try {
    // Sem ordem informada, entra no fim da fila em vez de brigar pelo lugar 0.
    const ultimo = await prisma.heroSlide.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const slide = await prisma.heroSlide.create({
      data: { ...d, order: d.order || (ultimo?.order ?? -1) + 1 },
      select: { id: true },
    });
    novoId = slide.id;
  } catch (e) {
    console.error("[hero] criar", e);
    return { success: false, error: "Não foi possível criar o slide." };
  }

  await auditar(membro, {
    acao: "hero.criar",
    entidade: "HeroSlide",
    entidadeId: novoId,
    descricao: `Criou o slide "${d.titleLine1}"`,
    depois: { titulo: d.titleLine1, ativo: d.active },
  });

  revalidarHome();
  redirect("/admin/hero-slides");
}

export async function atualizarHeroSlide(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  const parsed = heroSlideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const anterior = await prisma.heroSlide.findUnique({ where: { id } });
  if (!anterior) return { success: false, error: "Slide não encontrado." };

  try {
    await prisma.heroSlide.update({ where: { id }, data: parsed.data });
  } catch (e) {
    console.error("[hero] atualizar", e);
    return { success: false, error: "Não foi possível salvar o slide." };
  }

  const atual = await prisma.heroSlide.findUnique({ where: { id } });
  if (atual) {
    const m = diff(
      { ...anterior } as Record<string, unknown>,
      { ...atual } as Record<string, unknown>,
    );
    if (m.mudou) {
      await auditar(membro, {
        acao: "hero.editar",
        entidade: "HeroSlide",
        entidadeId: id,
        descricao: `Editou o slide "${parsed.data.titleLine1}"`,
        antes: m.antes,
        depois: m.depois,
      });
    }
  }

  revalidarHome();
  redirect("/admin/hero-slides");
}

export async function excluirHeroSlide(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  const slide = await prisma.heroSlide.findUnique({
    where: { id },
    select: { titleLine1: true },
  });
  if (!slide) return { success: false, error: "Slide não encontrado." };

  // A home sem nenhum slide fica com um buraco no topo. Melhor barrar aqui do
  // que deixar o site quebrado e o dono descobrir olhando.
  const total = await prisma.heroSlide.count();
  if (total <= 1) {
    return {
      success: false,
      error:
        "Este é o único slide. Crie outro antes de apagar, senão a home fica sem topo.",
    };
  }

  try {
    await prisma.heroSlide.delete({ where: { id } });
  } catch (e) {
    console.error("[hero] excluir", e);
    return { success: false, error: "Não foi possível apagar o slide." };
  }

  await auditar(membro, {
    acao: "hero.excluir",
    entidade: "HeroSlide",
    entidadeId: id,
    descricao: `Apagou o slide "${slide.titleLine1}"`,
  });

  revalidarHome();
  return { success: true, message: "Slide apagado." };
}

export async function alternarHeroSlide(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  const slide = await prisma.heroSlide.findUnique({
    where: { id },
    select: { active: true, titleLine1: true },
  });
  if (!slide) return { success: false, error: "Slide não encontrado." };

  // Desligar o último slide ativo deixaria a home sem topo — mesma regra do
  // apagar, só que aqui basta ligar outro para liberar.
  if (slide.active) {
    const ativos = await prisma.heroSlide.count({ where: { active: true } });
    if (ativos <= 1) {
      return {
        success: false,
        error: "Este é o único slide ligado. Ligue outro antes de desligar este.",
      };
    }
  }

  try {
    await prisma.heroSlide.update({
      where: { id },
      data: { active: !slide.active },
    });
  } catch (e) {
    console.error("[hero] alternar", e);
    return { success: false, error: "Não foi possível mudar o slide." };
  }

  await auditar(membro, {
    acao: slide.active ? "hero.desativar" : "hero.ativar",
    entidade: "HeroSlide",
    entidadeId: id,
    descricao: `${slide.active ? "Desligou" : "Ligou"} o slide "${slide.titleLine1}"`,
  });

  revalidarHome();
  return {
    success: true,
    message: slide.active ? "Slide desligado." : "Slide ligado.",
  };
}

/** Sobe ou desce um slide, trocando a ordem com o vizinho. */
export async function moverHeroSlide(
  id: string,
  direcao: "cima" | "baixo",
): Promise<ActionResult> {
  await assertPermissao("catalogo.editar");

  const todos = await prisma.heroSlide.findMany({
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const i = todos.findIndex((s) => s.id === id);
  if (i === -1) return { success: false, error: "Slide não encontrado." };

  const j = direcao === "cima" ? i - 1 : i + 1;
  if (j < 0 || j >= todos.length) return { success: true }; // ponta da lista

  try {
    // Reescreve a ordem inteira em sequência: mais simples de raciocinar que
    // trocar dois valores, e conserta ordens duplicadas de quebra.
    const nova = [...todos];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    await prisma.$transaction(
      nova.map((s, pos) =>
        prisma.heroSlide.update({ where: { id: s.id }, data: { order: pos } }),
      ),
    );
  } catch (e) {
    console.error("[hero] mover", e);
    return { success: false, error: "Não foi possível reordenar." };
  }

  revalidarHome();
  return { success: true };
}
