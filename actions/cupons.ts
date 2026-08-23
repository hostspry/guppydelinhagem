"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cupomSchema } from "@/lib/validations/cupom";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar, diff } from "@/lib/auditoria";
import {
  checarLimiteDesconto,
  type MembroAtual,
} from "@/lib/permissoes";
import { type ActionResult, isPrismaError } from "@/lib/utils/action-result";

// <input type="date"> → Date. Início do dia para validoDe; fim do dia para
// validoAte (o cupom vale o dia inteiro da data final).
const inicioDoDia = (s?: string) => (s ? new Date(`${s}T00:00:00`) : null);
const fimDoDia = (s?: string) => (s ? new Date(`${s}T23:59:59.999`) : null);

// Cupons de CAMPANHA aparecem na vitrine: ao criar/editar/excluir/ligar, revalida
// as rotas públicas. (A página de produto tem ISR de 60s; isto força o frescor.)
function revalidarRotasPublicas() {
  revalidatePath("/", "layout"); // home + /loja (vitrine) sob o layout público
  revalidatePath("/loja/[slug]", "page"); // páginas de produto
}

/** Monta os dados comuns de create/update a partir do input validado. */
function montarDados(d: ReturnType<typeof cupomSchema.parse>) {
  return {
    codigo: d.codigo,
    descricao: d.descricao?.trim() || null,
    tipoValor: d.tipoValor,
    valor: d.valor,
    escopo: d.escopo,
    modoAplicacao: d.modoAplicacao,
    tipoCupom: d.tipoCupom,
    precoUnicoNaCampanha: d.precoUnicoNaCampanha,
    ativo: d.ativo,
    validoDe: inicioDoDia(d.validoDe),
    validoAte: fimDoDia(d.validoAte),
    limiteUsos: d.limiteUsos ?? null,
    encerraAoEsgotarEstoque: d.encerraAoEsgotarEstoque,
    pedidoMinimo: d.pedidoMinimo ?? null,
  };
}

// Relações M:N por escopo: só conecta a relação do escopo escolhido; a outra fica
// vazia. `connect` no create; `set` no update (substitui/limpa o que não se usa).
function relacoesConnect(d: ReturnType<typeof cupomSchema.parse>) {
  return {
    categorias:
      d.escopo === "CATEGORIAS"
        ? { connect: d.categoriaIds.map((id) => ({ id })) }
        : undefined,
    produtos:
      d.escopo === "PRODUTOS"
        ? { connect: d.produtoIds.map((id) => ({ id })) }
        : undefined,
  };
}

function relacoesSet(d: ReturnType<typeof cupomSchema.parse>) {
  return {
    categorias: {
      set: d.escopo === "CATEGORIAS" ? d.categoriaIds.map((id) => ({ id })) : [],
    },
    produtos: {
      set: d.escopo === "PRODUTOS" ? d.produtoIds.map((id) => ({ id })) : [],
    },
  };
}

/**
 * Teto de desconto do membro aplicado ao cupom. O limite é em %, então cupom
 * percentual compara direto. Cupom de VALOR fixo não tem base de comparação (R$
 * não vira % sem saber o carrinho) — quem tem teto não cria cupom fixo, e a
 * mensagem diz o que fazer.
 */
function checarCupomNoLimite(
  membro: MembroAtual,
  d: ReturnType<typeof cupomSchema.parse>,
): string | null {
  if (membro.semLimites || membro.limiteDescontoPercent == null) return null;
  if (d.tipoValor === "PERCENTUAL") return checarLimiteDesconto(membro, d.valor);
  return `Seu limite de desconto é ${membro.limiteDescontoPercent}%, então você só pode criar cupons percentuais. Peça a um administrador para criar cupons em reais.`;
}

export async function createCupom(input: unknown): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  const parsed = cupomSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos do formulário.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const foraDoLimite = checarCupomNoLimite(membro, d);
  if (foraDoLimite) return { success: false, error: foraDoLimite };

  try {
    await prisma.cupomDesconto.create({
      data: { ...montarDados(d), ...relacoesConnect(d) },
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return { success: false, error: "Já existe um cupom com esse código." };
    }
    console.error("[cupom] criar", e);
    return { success: false, error: "Não foi possível criar o cupom." };
  }

  await auditar(membro, {
    acao: "cupom.criar",
    entidade: "CupomDesconto",
    descricao: `Criou o cupom ${d.codigo}`,
    depois: { codigo: d.codigo, tipoValor: d.tipoValor, valor: d.valor },
  });

  revalidatePath("/admin/cupons");
  revalidarRotasPublicas();
  redirect("/admin/cupons");
}

export async function updateCupom(
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  const parsed = cupomSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos do formulário.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const foraDoLimite = checarCupomNoLimite(membro, d);
  if (foraDoLimite) return { success: false, error: foraDoLimite };

  try {
    await prisma.cupomDesconto.update({
      where: { id },
      data: { ...montarDados(d), ...relacoesSet(d) },
    });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2002") {
      return { success: false, error: "Já existe um cupom com esse código." };
    }
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Cupom não encontrado." };
    }
    console.error("[cupom] atualizar", e);
    return { success: false, error: "Não foi possível salvar o cupom." };
  }

  await auditar(membro, {
    acao: "cupom.atualizar",
    entidade: "CupomDesconto",
    entidadeId: id,
    descricao: `Editou o cupom ${d.codigo}`,
    depois: { codigo: d.codigo, tipoValor: d.tipoValor, valor: d.valor, ativo: d.ativo },
  });

  revalidatePath("/admin/cupons");
  revalidarRotasPublicas();
  redirect("/admin/cupons");
}

export async function deleteCupom(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.excluir");
  const alvo = await prisma.cupomDesconto.findUnique({
    where: { id },
    select: { codigo: true, valor: true, tipoValor: true },
  });

  try {
    // Pedidos que usaram o cupom mantêm o snapshot cupomCodigo (FK = SetNull).
    await prisma.cupomDesconto.delete({ where: { id } });
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Cupom não encontrado." };
    }
    console.error("[cupom] excluir", e);
    return { success: false, error: "Não foi possível excluir o cupom." };
  }

  revalidatePath("/admin/cupons");
  revalidarRotasPublicas();
  await auditar(membro, {
    acao: "cupom.excluir",
    entidade: "CupomDesconto",
    entidadeId: id,
    descricao: `Excluiu o cupom ${alvo?.codigo ?? id}`,
    antes: alvo ? { codigo: alvo.codigo, valor: alvo.valor } : undefined,
  });

  return { success: true, message: "Cupom excluído." };
}

export async function toggleCupomAtivo(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("catalogo.editar");

  try {
    const atual = await prisma.cupomDesconto.findUnique({
      where: { id },
      select: { ativo: true },
    });
    if (!atual) return { success: false, error: "Cupom não encontrado." };
    await prisma.cupomDesconto.update({
      where: { id },
      data: { ativo: !atual.ativo },
    });
  } catch (e) {
    console.error("[cupom] toggle ativo", e);
    return { success: false, error: "Não foi possível atualizar o cupom." };
  }

  await auditar(membro, {
    acao: "cupom.ativar",
    entidade: "CupomDesconto",
    entidadeId: id,
    descricao: "Ligou/desligou um cupom",
  });

  revalidatePath("/admin/cupons");
  revalidarRotasPublicas();
  return { success: true };
}
