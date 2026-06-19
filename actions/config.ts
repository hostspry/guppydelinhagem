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

  // Frete grátis: toggle (checkbox) + valor mínimo em R$. Sem valor válido (>0),
  // grava null — a regra só "liga" com ativo E valor definido.
  const freteGratisAtivo = formData.get("freteGratisAtivo") === "on";
  const valorRaw = Number(
    String(formData.get("freteGratisAcimaDe") ?? "").replace(",", "."),
  );
  const freteGratisAcimaDe =
    Number.isFinite(valorRaw) && valorRaw > 0
      ? Math.round(valorRaw * 100) / 100
      : null;

  try {
    await prisma.configuracaoLoja.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        descontoPixGlobalPercent: pct,
        freteGratisAtivo,
        freteGratisAcimaDe,
      },
      update: { descontoPixGlobalPercent: pct, freteGratisAtivo, freteGratisAcimaDe },
    });
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao salvar as configurações." };
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/checkout");
  revalidatePath("/", "layout"); // vitrine (desconto global) + faixa do topo (Navbar)
  return { success: true, message: "Configurações salvas." };
}
