"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import type { ActionResult } from "@/lib/utils/action-result";

/**
 * Limpeza do histórico de visitantes.
 *
 * Nada é apagado automaticamente (foi a escolha do dono): quem decide é ele,
 * aqui, informando a partir de quantos dias atrás pode ir embora. A própria
 * limpeza fica registrada na auditoria — apagar histórico é uma ação que
 * merece histórico.
 */
export async function limparRastreioAntigo(
  diasParaTras: number,
): Promise<ActionResult> {
  const membro = await assertPermissao("auditoria.ver");

  if (!Number.isFinite(diasParaTras) || diasParaTras < 30) {
    return {
      success: false,
      error: "Por segurança, a limpeza só apaga registros com mais de 30 dias.",
    };
  }

  const corte = new Date(Date.now() - diasParaTras * 24 * 60 * 60 * 1000);

  try {
    // Eventos primeiro; sessões e visitantes que ficaram sem nada vão junto,
    // para não deixar casca vazia no banco.
    const eventos = await prisma.eventoVisitante.deleteMany({
      where: { ocorridoEm: { lt: corte } },
    });
    const sessoes = await prisma.sessaoVisita.deleteMany({
      where: { ultimaAtividade: { lt: corte }, eventos: { none: {} } },
    });
    const visitantes = await prisma.visitante.deleteMany({
      where: {
        ultimoAcesso: { lt: corte },
        eventos: { none: {} },
        sessoes: { none: {} },
      },
    });

    await auditar(membro, {
      acao: "rastreio.limpar",
      descricao: `Apagou o histórico de visitantes anterior a ${corte.toLocaleDateString("pt-BR")}`,
      depois: {
        eventos: eventos.count,
        sessoes: sessoes.count,
        visitantes: visitantes.count,
      },
    });

    revalidatePath("/admin/visitantes");
    return {
      success: true,
      message: `${eventos.count} evento(s), ${sessoes.count} visita(s) e ${visitantes.count} visitante(s) removidos.`,
    };
  } catch (e) {
    console.error("[rastreio] limpeza", e);
    return { success: false, error: "Não foi possível limpar o histórico." };
  }
}
