"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { type ActionResult, isPrismaError } from "@/lib/utils/action-result";
import {
  categoriaFinanceiraSchema,
  confirmarVendaSchema,
  lancamentoSchema,
  recorrenciaSchema,
} from "@/lib/validations/financeiro";
import { dataDoDia, vencimentoNaCompetencia } from "@/lib/financeiro/periodo";
import {
  SLUG_FRETE_POSTAGEM,
  SLUG_TAXA_PAGAMENTO,
} from "@/lib/financeiro/categorias-padrao";

function revalidarFinanceiro() {
  revalidatePath("/admin/financeiro", "layout");
}

function erroDeCampos(parsed: { error: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } } }) {
  const fieldErrors: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(parsed.error.flatten().fieldErrors)) {
    if (v) fieldErrors[k] = v;
  }
  return {
    success: false as const,
    error: "Confira os campos do formulário.",
    fieldErrors,
  };
}

// ─────────────────────────────────────────────
// Lançamentos
// ─────────────────────────────────────────────

export async function criarLancamento(input: unknown): Promise<ActionResult> {
  const membro = await assertPermissao("financeiro.gerenciar");

  const parsed = lancamentoSchema.safeParse(input);
  if (!parsed.success) return erroDeCampos(parsed);
  const d = parsed.data;

  const data = dataDoDia(d.data);
  if (!data) return { success: false, error: "Data inválida." };
  const vencimento = d.vencimento ? dataDoDia(d.vencimento) : null;

  // Conta a pagar nasce PENDENTE: só entra no caixa quando for quitada. Sem
  // vencimento, o lançamento é dinheiro que já se moveu.
  const ehConta = d.aPagar && vencimento !== null;

  try {
    await prisma.lancamento.create({
      data: {
        tipo: d.tipo,
        status: ehConta ? "PENDENTE" : "CONFIRMADO",
        origem: d.comprovanteUrl ? "COMPROVANTE" : "MANUAL",
        descricao: d.descricao,
        valor: d.valor,
        data: ehConta ? (vencimento ?? data) : data,
        vencimento: ehConta ? vencimento : null,
        categoriaId: d.categoriaId,
        observacoes: d.observacoes,
        comprovanteUrl: d.comprovanteUrl,
        // Marcação de venda só existe em entrada; numa saída não guarda nada.
        canal: d.tipo === "ENTRADA" ? d.canal : null,
        campanha: d.tipo === "ENTRADA" ? d.campanha : null,
        criadoPorId: membro.id,
      },
    });
  } catch (e) {
    console.error("[financeiro] criar", e);
    return { success: false, error: "Não foi possível salvar o lançamento." };
  }

  await auditar(membro, {
    acao: "financeiro.lancar",
    entidade: "Lancamento",
    descricao: `Lançou ${d.tipo === "ENTRADA" ? "entrada" : "saída"} de ${d.valor.toFixed(2)} — ${d.descricao}`,
    depois: { tipo: d.tipo, valor: d.valor, data: d.data, aPagar: ehConta },
  });

  revalidarFinanceiro();
  return { success: true, message: ehConta ? "Conta agendada." : "Lançamento salvo." };
}

export async function atualizarLancamento(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const membro = await assertPermissao("financeiro.gerenciar");

  const atual = await prisma.lancamento.findUnique({
    where: { id },
    select: { origem: true, status: true },
  });
  if (!atual) return { success: false, error: "Lançamento não encontrado." };

  // Linhas geradas pelo sistema espelham um pedido: mexer nelas à mão faria o
  // caixa descolar da venda. Para corrigir, mexe-se no pedido.
  if (atual.origem === "PEDIDO" && atual.status === "CONFIRMADO") {
    return {
      success: false,
      error:
        "Esta entrada veio de uma venda do site e não pode ser editada à mão. Ajuste pelo pedido.",
    };
  }

  const parsed = lancamentoSchema.safeParse(input);
  if (!parsed.success) return erroDeCampos(parsed);
  const d = parsed.data;

  const data = dataDoDia(d.data);
  if (!data) return { success: false, error: "Data inválida." };
  const vencimento = d.vencimento ? dataDoDia(d.vencimento) : null;
  const ehConta = d.aPagar && vencimento !== null;

  try {
    await prisma.lancamento.update({
      where: { id },
      data: {
        tipo: d.tipo,
        descricao: d.descricao,
        valor: d.valor,
        data: ehConta ? (vencimento ?? data) : data,
        vencimento: ehConta ? vencimento : null,
        status: ehConta ? "PENDENTE" : "CONFIRMADO",
        categoriaId: d.categoriaId,
        observacoes: d.observacoes,
        comprovanteUrl: d.comprovanteUrl,
        canal: d.tipo === "ENTRADA" ? d.canal : null,
        campanha: d.tipo === "ENTRADA" ? d.campanha : null,
      },
    });
  } catch (e) {
    console.error("[financeiro] atualizar", e);
    return { success: false, error: "Não foi possível salvar as alterações." };
  }

  await auditar(membro, {
    acao: "financeiro.editar",
    entidade: "Lancamento",
    entidadeId: id,
    descricao: `Editou o lançamento "${d.descricao}" (${d.valor.toFixed(2)})`,
    antes: { status: atual.status, origem: atual.origem },
    depois: { tipo: d.tipo, valor: d.valor, data: d.data },
  });

  revalidarFinanceiro();
  return { success: true, message: "Lançamento atualizado." };
}

export async function excluirLancamento(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("financeiro.gerenciar");

  const atual = await prisma.lancamento.findUnique({
    where: { id },
    select: { origem: true, status: true, descricao: true, valor: true, tipo: true },
  });
  if (!atual) return { success: false, error: "Lançamento não encontrado." };

  if (atual.origem === "PEDIDO" && atual.status === "CONFIRMADO") {
    return {
      success: false,
      error:
        "Entrada de venda do site não se apaga aqui — cancele ou estorne o pedido.",
    };
  }

  try {
    await prisma.lancamento.delete({ where: { id } });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Lançamento não encontrado." };
    }
    console.error("[financeiro] excluir", e);
    return { success: false, error: "Não foi possível excluir." };
  }

  await auditar(membro, {
    acao: "financeiro.excluir",
    entidade: "Lancamento",
    entidadeId: id,
    descricao: `Excluiu o lançamento "${atual.descricao}" (${Number(atual.valor).toFixed(2)})`,
    antes: { tipo: atual.tipo, valor: atual.valor, descricao: atual.descricao },
  });

  revalidarFinanceiro();
  return { success: true, message: "Lançamento excluído." };
}

/** Conta a pagar/receber vira dinheiro que se moveu, na data informada. */
export async function marcarComoPago(
  id: string,
  dataPagamento?: string,
): Promise<ActionResult> {
  const membro = await assertPermissao("financeiro.gerenciar");

  const quando = dataPagamento ? dataDoDia(dataPagamento) : new Date();
  if (!quando) return { success: false, error: "Data inválida." };

  try {
    await prisma.lancamento.update({
      where: { id },
      data: { status: "CONFIRMADO", data: quando },
    });
  } catch (e) {
    console.error("[financeiro] marcar pago", e);
    return { success: false, error: "Não foi possível dar baixa." };
  }

  await auditar(membro, {
    acao: "financeiro.baixa",
    entidade: "Lancamento",
    entidadeId: id,
    descricao: "Deu baixa numa conta",
    depois: { data: quando },
  });

  revalidarFinanceiro();
  return { success: true, message: "Baixa registrada." };
}

// ─────────────────────────────────────────────
// Vendas do site (sugestões a conferir)
// ─────────────────────────────────────────────

async function categoriaPorSlug(slug: string): Promise<string | null> {
  const c = await prisma.categoriaFinanceira.findUnique({
    where: { slug },
    select: { id: true },
  });
  return c?.id ?? null;
}

/**
 * Confirma a entrada de uma venda e, de quebra, registra os custos dela: a taxa
 * do gateway e a postagem viram SAÍDAS ligadas ao mesmo pedido. É assim que o
 * caixa mostra o que a venda realmente deixou.
 */
export async function confirmarVenda(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const membro = await assertPermissao("financeiro.gerenciar");

  const parsed = confirmarVendaSchema.safeParse(input);
  if (!parsed.success) return erroDeCampos(parsed);
  const { data: dataStr, taxaGateway, custoFrete } = parsed.data;

  const data = dataDoDia(dataStr);
  if (!data) return { success: false, error: "Data inválida." };

  const sugestao = await prisma.lancamento.findUnique({
    where: { id },
    select: { id: true, status: true, orderId: true, pagamentoId: true, origem: true },
  });
  if (!sugestao) return { success: false, error: "Lançamento não encontrado." };
  if (sugestao.status === "CONFIRMADO") {
    return { success: true, message: "Esta venda já estava confirmada." };
  }

  const [idTaxa, idFrete] = await Promise.all([
    categoriaPorSlug(SLUG_TAXA_PAGAMENTO),
    categoriaPorSlug(SLUG_FRETE_POSTAGEM),
  ]);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.lancamento.update({
        where: { id },
        data: { status: "CONFIRMADO", data },
      });

      // upsert pela trava (pagamentoId, origem): confirmar duas vezes não duplica
      // a taxa nem o frete, só atualiza o valor.
      if (taxaGateway && taxaGateway > 0 && sugestao.pagamentoId) {
        await tx.lancamento.upsert({
          where: {
            pagamentoId_origem: {
              pagamentoId: sugestao.pagamentoId,
              origem: "TAXA_PAGAMENTO",
            },
          },
          create: {
            tipo: "SAIDA",
            status: "CONFIRMADO",
            origem: "TAXA_PAGAMENTO",
            descricao: "Taxa do meio de pagamento",
            valor: taxaGateway,
            data,
            categoriaId: idTaxa,
            orderId: sugestao.orderId,
            pagamentoId: sugestao.pagamentoId,
            criadoPorId: membro.id,
          },
          update: { valor: taxaGateway, data, status: "CONFIRMADO" },
        });
      }

      if (custoFrete && custoFrete > 0 && sugestao.pagamentoId) {
        await tx.lancamento.upsert({
          where: {
            pagamentoId_origem: {
              pagamentoId: sugestao.pagamentoId,
              origem: "FRETE",
            },
          },
          create: {
            tipo: "SAIDA",
            status: "CONFIRMADO",
            origem: "FRETE",
            descricao: "Postagem do pedido",
            valor: custoFrete,
            data,
            categoriaId: idFrete,
            orderId: sugestao.orderId,
            pagamentoId: sugestao.pagamentoId,
            criadoPorId: membro.id,
          },
          update: { valor: custoFrete, data, status: "CONFIRMADO" },
        });
      }
    });
  } catch (e) {
    console.error("[financeiro] confirmar venda", e);
    return { success: false, error: "Não foi possível confirmar a venda." };
  }

  await auditar(membro, {
    acao: "financeiro.confirmar-venda",
    entidade: "Lancamento",
    entidadeId: id,
    descricao: `Confirmou uma venda no caixa${taxaGateway ? ` (taxa ${taxaGateway})` : ""}${custoFrete ? ` (postagem ${custoFrete})` : ""}`,
    depois: { data: dataStr, taxaGateway, custoFrete },
  });

  revalidarFinanceiro();
  return { success: true, message: "Venda confirmada no caixa." };
}

/** Sugestão que não deve entrar no caixa (venda de teste, duplicada…). */
export async function descartarSugestao(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("financeiro.gerenciar");

  try {
    await prisma.lancamento.update({
      where: { id },
      data: { status: "DESCARTADO" },
    });
  } catch (e) {
    console.error("[financeiro] descartar", e);
    return { success: false, error: "Não foi possível descartar." };
  }

  await auditar(membro, {
    acao: "financeiro.descartar-venda",
    entidade: "Lancamento",
    entidadeId: id,
    descricao: "Descartou uma venda do site do caixa",
  });

  revalidarFinanceiro();
  return { success: true, message: "Sugestão descartada." };
}

// ─────────────────────────────────────────────
// Categorias
// ─────────────────────────────────────────────

function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function criarCategoria(input: unknown): Promise<ActionResult> {
  await assertPermissao("financeiro.gerenciar");

  const parsed = categoriaFinanceiraSchema.safeParse(input);
  if (!parsed.success) return erroDeCampos(parsed);
  const d = parsed.data;

  const base = slugify(d.nome) || "categoria";
  try {
    const existente = await prisma.categoriaFinanceira.findUnique({
      where: { slug: base },
      select: { id: true },
    });
    await prisma.categoriaFinanceira.create({
      data: {
        nome: d.nome,
        // Slug é chave técnica: se bater com uma existente, desambigua sozinho.
        slug: existente ? `${base}-${Date.now().toString(36).slice(-4)}` : base,
        tipo: d.tipo,
        ordem: 999,
      },
    });
  } catch (e) {
    console.error("[financeiro] criar categoria", e);
    return { success: false, error: "Não foi possível criar a categoria." };
  }

  revalidarFinanceiro();
  return { success: true, message: "Categoria criada." };
}

export async function renomearCategoria(
  id: string,
  nome: string,
): Promise<ActionResult> {
  await assertPermissao("financeiro.gerenciar");

  const limpo = nome.trim();
  if (limpo.length < 2) return { success: false, error: "Nome muito curto." };

  try {
    await prisma.categoriaFinanceira.update({
      where: { id },
      data: { nome: limpo },
    });
  } catch (e) {
    console.error("[financeiro] renomear categoria", e);
    return { success: false, error: "Não foi possível renomear." };
  }

  revalidarFinanceiro();
  return { success: true, message: "Categoria renomeada." };
}

/**
 * Categoria some da lista de escolha mas continua valendo no histórico. Se nunca
 * foi usada e não é do sistema, apaga de vez — não faz sentido guardar lixo.
 */
export async function arquivarCategoria(id: string): Promise<ActionResult> {
  await assertPermissao("financeiro.gerenciar");

  const cat = await prisma.categoriaFinanceira.findUnique({
    where: { id },
    select: { sistema: true, ativa: true, _count: { select: { lancamentos: true } } },
  });
  if (!cat) return { success: false, error: "Categoria não encontrada." };

  if (cat.sistema) {
    return {
      success: false,
      error:
        "Esta categoria é usada automaticamente pelo sistema (vendas, taxas, postagem). Você pode renomeá-la, mas não desativá-la.",
    };
  }

  try {
    if (cat._count.lancamentos === 0) {
      await prisma.categoriaFinanceira.delete({ where: { id } });
      revalidarFinanceiro();
      return { success: true, message: "Categoria excluída." };
    }
    await prisma.categoriaFinanceira.update({
      where: { id },
      data: { ativa: !cat.ativa },
    });
  } catch (e) {
    console.error("[financeiro] arquivar categoria", e);
    return { success: false, error: "Não foi possível alterar a categoria." };
  }

  revalidarFinanceiro();
  return {
    success: true,
    message: cat.ativa ? "Categoria desativada." : "Categoria reativada.",
  };
}

// ─────────────────────────────────────────────
// Recorrentes
// ─────────────────────────────────────────────

export async function salvarRecorrencia(
  id: string | null,
  input: unknown,
): Promise<ActionResult> {
  await assertPermissao("financeiro.gerenciar");

  const parsed = recorrenciaSchema.safeParse(input);
  if (!parsed.success) return erroDeCampos(parsed);
  const d = parsed.data;

  const dados = {
    tipo: d.tipo,
    descricao: d.descricao,
    valor: d.valor,
    diaVencimento: d.diaVencimento,
    categoriaId: d.categoriaId,
    observacoes: d.observacoes,
    ativa: d.ativa,
  };

  try {
    if (id) {
      await prisma.recorrenciaFinanceira.update({ where: { id }, data: dados });
    } else {
      await prisma.recorrenciaFinanceira.create({ data: dados });
    }
  } catch (e) {
    console.error("[financeiro] salvar recorrência", e);
    return { success: false, error: "Não foi possível salvar a conta recorrente." };
  }

  revalidarFinanceiro();
  return { success: true, message: id ? "Conta atualizada." : "Conta recorrente criada." };
}

export async function excluirRecorrencia(id: string): Promise<ActionResult> {
  await assertPermissao("financeiro.gerenciar");

  try {
    // As contas já geradas ficam (recorrenciaId vira null pela FK SetNull) — o
    // histórico do caixa não pode sumir porque a regra foi apagada.
    await prisma.recorrenciaFinanceira.delete({ where: { id } });
  } catch (e) {
    console.error("[financeiro] excluir recorrência", e);
    return { success: false, error: "Não foi possível excluir." };
  }

  revalidarFinanceiro();
  return { success: true, message: "Conta recorrente removida." };
}

/**
 * Gera as contas do mês a partir das recorrências ativas. Chamada pelo cron e
 * pelo botão "gerar agora". Idempotente por `ultimaCompetencia`.
 */
export async function gerarContasDaCompetencia(
  competencia: string,
): Promise<{ criadas: number }> {
  const recorrencias = await prisma.recorrenciaFinanceira.findMany({
    where: { ativa: true, NOT: { ultimaCompetencia: competencia } },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      valor: true,
      diaVencimento: true,
      categoriaId: true,
      observacoes: true,
    },
  });

  let criadas = 0;
  for (const r of recorrencias) {
    const vencimento = vencimentoNaCompetencia(competencia, r.diaVencimento);
    await prisma.$transaction(async (tx) => {
      await tx.lancamento.create({
        data: {
          tipo: r.tipo,
          status: "PENDENTE",
          origem: "RECORRENCIA",
          descricao: r.descricao,
          valor: r.valor,
          data: vencimento,
          vencimento,
          categoriaId: r.categoriaId,
          observacoes: r.observacoes,
          recorrenciaId: r.id,
        },
      });
      await tx.recorrenciaFinanceira.update({
        where: { id: r.id },
        data: { ultimaCompetencia: competencia },
      });
    });
    criadas++;
  }

  if (criadas > 0) revalidarFinanceiro();
  return { criadas };
}

export async function gerarContasDoMes(competencia: string): Promise<ActionResult> {
  await assertPermissao("financeiro.gerenciar");
  const { criadas } = await gerarContasDaCompetencia(competencia);
  return {
    success: true,
    message:
      criadas === 0
        ? "As contas deste mês já estavam geradas."
        : `${criadas} conta(s) gerada(s) para este mês.`,
  };
}
