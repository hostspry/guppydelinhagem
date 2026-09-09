"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar, diff } from "@/lib/auditoria";
import {
  type ActionResult,
} from "@/lib/utils/action-result";

const DEFAULT_ID = "default";

/**
 * Salva as configurações globais da loja (singleton). Admin only.
 *
 * A tela é dividida em abas, e cada aba manda só a SUA parte — junto com um
 * campo `secao` por bloco enviado. Sem isso, salvar em "Entrega" gravaria os
 * campos de "Pagamentos" como ausentes (checkbox que não vem no FormData é
 * indistinguível de checkbox desmarcado) e apagaria o que estava lá.
 *
 * Sem nenhum `secao` no formulário, grava tudo — é o formato antigo, de quando
 * havia um form só.
 */
export async function salvarConfiguracaoLoja(
  formData: FormData,
): Promise<ActionResult> {
  const membro = await assertPermissao("config.editar");
  const anterior = await prisma.configuracaoLoja.findUnique({
    where: { id: "default" },
  });

  const secoes = new Set(formData.getAll("secao").map(String));
  const enviou = (s: string) => secoes.size === 0 || secoes.has(s);

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

  // Taxa fixa de embalagem do produto seco (caixa/plástico bolha). Somada à
  // cotação do Melhor Envio — o isopor de R$ 20 continua sendo só do peixe.
  const taxaRaw = Number(
    String(formData.get("taxaEmbalagemSeco") ?? "").replace(",", "."),
  );
  const taxaEmbalagemSeco =
    Number.isFinite(taxaRaw) && taxaRaw >= 0 ? Math.round(taxaRaw * 100) / 100 : 5;

  // Remetente da etiqueta. Guardado como veio (só o essencial normalizado):
  // é dado de endereço, não número de conta.
  const remetenteNome = String(formData.get("remetenteNome") ?? "").trim() || null;
  const remetenteDocumento = String(formData.get("remetenteDocumento") ?? "").trim() || null;
  const remetenteEmail = String(formData.get("remetenteEmail") ?? "").trim() || null;
  const remetenteTelefone = String(formData.get("remetenteTelefone") ?? "").trim() || null;
  const remetenteCep = String(formData.get("remetenteCep") ?? "").trim() || null;
  const remetenteLogradouro = String(formData.get("remetenteLogradouro") ?? "").trim() || null;
  const remetenteNumero = String(formData.get("remetenteNumero") ?? "").trim() || null;
  const remetenteComplemento = String(formData.get("remetenteComplemento") ?? "").trim() || null;
  const remetenteBairro = String(formData.get("remetenteBairro") ?? "").trim() || null;
  const remetenteCidade = String(formData.get("remetenteCidade") ?? "").trim() || null;
  const remetenteUf = String(formData.get("remetenteUf") ?? "").trim() || null;

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

  // Só entra no update o que a aba realmente mandou.
  const doPagamento = enviou("pagamentos")
    ? { descontoPixGlobalPercent: pct, pagbankAtivo }
    : {};
  const daEntrega = enviou("entrega")
    ? {
        freteGratisAtivo,
        freteGratisAcimaDe,
        maxPeixesFreteAuto,
        taxaEmbalagemSeco,
        remetenteNome,
        remetenteDocumento,
        remetenteEmail,
        remetenteTelefone,
        remetenteCep,
        remetenteLogradouro,
        remetenteNumero,
        remetenteComplemento,
        remetenteBairro,
        remetenteCidade,
        remetenteUf,
        retiradaLocalAtiva,
        retiradaInstrucoes,
      }
    : {};
  const daLoja = enviou("loja") ? { tarjaAtiva, tarjaTexto } : {};

  try {
    await prisma.configuracaoLoja.upsert({
      where: { id: DEFAULT_ID },
      // Na criação a linha precisa nascer completa; o que a aba não mandou fica
      // com o default de cada campo.
      create: {
        id: DEFAULT_ID,
        descontoPixGlobalPercent: pct,
        freteGratisAtivo,
        freteGratisAcimaDe,
        maxPeixesFreteAuto,
        taxaEmbalagemSeco,
        retiradaLocalAtiva,
        retiradaInstrucoes,
        tarjaAtiva,
        tarjaTexto,
        pagbankAtivo,
      },
      update: { ...doPagamento, ...daEntrega, ...daLoja },
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
