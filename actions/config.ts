"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  type ActionResult,
  assertAuthorized,
} from "@/lib/utils/action-result";

const DEFAULT_ID = "default";

/** Salva as configurações globais da loja (singleton). Admin only. */
export async function salvarConfiguracaoLoja(
  formData: FormData,
): Promise<ActionResult> {
  await assertAuthorized();

  const raw = Number(formData.get("descontoPixGlobalPercent"));
  const pct = Number.isFinite(raw)
    ? Math.min(100, Math.max(0, Math.round(raw)))
    : 0;

  try {
    await prisma.configuracaoLoja.upsert({
      where: { id: DEFAULT_ID },
      create: { id: DEFAULT_ID, descontoPixGlobalPercent: pct },
      update: { descontoPixGlobalPercent: pct },
    });
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao salvar as configurações." };
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/checkout");
  revalidatePath("/"); // vitrine reflete o desconto global
  return { success: true, message: "Configurações salvas." };
}
