"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar, diff } from "@/lib/auditoria";
import {
  type ActionResult,
} from "@/lib/utils/action-result";

const DEFAULT_ID = "default";

/** Salva as configurações globais da loja (singleton). Admin only. */
export async function salvarConfiguracaoLoja(
  formData: FormData,
): Promise<ActionResult> {
  const membro = await assertPermissao("config.editar");
  const anterior = await prisma.configuracaoLoja.findUnique({
    where: { id: "default" },
  });

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

  // Limite de peixes para frete automático (≥ 1; acima → WhatsApp). Default 10.
  const maxRaw = Number(formData.get("maxPeixesFreteAuto"));
  const maxPeixesFreteAuto =
    Number.isFinite(maxRaw) && maxRaw >= 1 ? Math.round(maxRaw) : 10;

  // Retirada local: toggle + texto livre das instruções (vazio → null).
  const retiradaLocalAtiva = formData.get("retiradaLocalAtiva") === "on";
  const retiradaInstrucoesRaw = String(
    formData.get("retiradaInstrucoes") ?? "",
  ).trim();
  const retiradaInstrucoes = retiradaInstrucoesRaw || null;

  // Tarja promocional do topo: toggle + texto livre (vazio → null, usa o fallback).
  const tarjaAtiva = formData.get("tarjaAtiva") === "on";
  const tarjaTextoRaw = String(formData.get("tarjaTexto") ?? "").trim();
  const tarjaTexto = tarjaTextoRaw || null;

  // PagBank: liga/desliga as opções PagBank no checkout (sem deploy).
  const pagbankAtivo = formData.get("pagbankAtivo") === "on";

  try {
    await prisma.configuracaoLoja.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        descontoPixGlobalPercent: pct,
        freteGratisAtivo,
        freteGratisAcimaDe,
        maxPeixesFreteAuto,
        retiradaLocalAtiva,
        retiradaInstrucoes,
        tarjaAtiva,
        tarjaTexto,
        pagbankAtivo,
      },
      update: {
        descontoPixGlobalPercent: pct,
        freteGratisAtivo,
        freteGratisAcimaDe,
        maxPeixesFreteAuto,
        retiradaLocalAtiva,
        retiradaInstrucoes,
        tarjaAtiva,
        tarjaTexto,
        pagbankAtivo,
      },
    });
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao salvar as configurações." };
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/checkout");
  revalidatePath("/carrinho");
  revalidatePath("/loja/[slug]", "page"); // selo de frete grátis na página de produto
  revalidatePath("/", "layout"); // vitrine (desconto global) + faixa do topo (Navbar)
  const atual = await prisma.configuracaoLoja.findUnique({
    where: { id: "default" },
  });
  if (anterior && atual) {
    const mudancas = diff(
      { ...anterior } as Record<string, unknown>,
      { ...atual } as Record<string, unknown>,
    );
    if (mudancas.mudou) {
      await auditar(membro, {
        acao: "config.salvar",
        entidade: "ConfiguracaoLoja",
        entidadeId: "default",
        descricao: "Alterou as configurações da loja",
        antes: mudancas.antes,
        depois: mudancas.depois,
      });
    }
  }

  return { success: true, message: "Configurações salvas." };
}
