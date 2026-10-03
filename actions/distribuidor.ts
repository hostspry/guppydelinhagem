"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermissao, assertSegmento } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import type { ActionResult } from "@/lib/utils/action-result";
import { dataDoDia } from "@/lib/financeiro/periodo";
import {
  registrarRecebimentoDistribuidor,
  sincronizarSaldoDistribuidor,
} from "@/lib/financeiro/distribuidor";
import {
  pedidoDistribuidorSchema,
  recebimentoDistribuidorSchema,
} from "@/lib/validations/distribuidor";
import type { Prisma } from "@/lib/generated/prisma/client";

export type PedidoDistribuidorResult =
  | { success: true; orderId: string; numero: string; falta: number }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

const round2 = (n: number) => Math.round(n * 100) / 100;
const soDigitos = (s: string) => s.replace(/\D/g, "");

const FORMA_PEDIDO = {
  PIX: "PIX",
  DINHEIRO: "DINHEIRO",
  CARTAO: "CARTAO",
  BOLETO: "BOLETO",
  OUTRO: "OUTRO",
} as const;

function revalidar(orderId?: string) {
  revalidatePath("/admin/pedidos");
  if (orderId) revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/financeiro", "layout");
}

/**
 * Registra o que o distribuidor levou e o quanto já pagou.
 *
 * O pedido nasce ENTREGUE e como RETIRADA: o peixe já saiu na mão, então não
 * entra em nenhuma rotina de envio, etiqueta ou cancelamento automático. Os
 * itens são avulsos (não baixam estoque), porque a separação para revenda sai
 * do lote, não de anúncio do site.
 */
export async function criarPedidoDistribuidor(
  input: unknown,
): Promise<PedidoDistribuidorResult> {
  const membro = await assertPermissao("pedidos.editar");
  // O pedido mexe no caixa da estufa: precisa enxergar esse caixa.
  if (!membro.permissoes.includes("financeiro.gerenciar")) {
    return {
      success: false,
      error: "Seu cargo não lança no financeiro. Peça para quem cuida do caixa.",
    };
  }
  assertSegmento(membro, "PEIXES_VIVOS");

  const parsed = pedidoDistribuidorSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Confira os campos destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const d = parsed.data;

  const data = dataDoDia(d.data);
  if (!data) return { success: false, error: "Data inválida." };
  const vencimento = d.vencimentoSaldo ? dataDoDia(d.vencimentoSaldo) : null;

  // Linha "150 mix - 450,00": guarda 150 × 3,00. Quando a divisão não fecha no
  // centavo (40 peixes por 45,00), a quantidade vai no nome e a linha fica 1 ×
  // valor, para a soma dos itens bater com o combinado.
  const itens = d.itens.map((it) => {
    const unit = round2(it.valor / it.quantidade);
    const exato = round2(unit * it.quantidade) === round2(it.valor);
    return exato
      ? { nomeProduto: it.nome, quantidade: it.quantidade, precoUnitario: unit }
      : {
          nomeProduto: `${it.quantidade}x ${it.nome}`,
          quantidade: 1,
          precoUnitario: round2(it.valor),
        };
  });
  const soma = round2(itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0));
  const total = d.total ?? soma;

  // Total combinado acima da soma: a diferença vira uma linha, para não sumir
  // dinheiro. Abaixo: é desconto.
  if (total > soma) {
    itens.push({
      nomeProduto: "Diferença do combinado",
      quantidade: 1,
      precoUnitario: round2(total - soma),
    });
  }
  const subtotal = Math.max(soma, total);
  const desconto = round2(Math.max(0, soma - total));

  if (d.valorPago > total) {
    return {
      success: false,
      error: "O valor pago é maior que o total.",
      fieldErrors: { valorPago: ["Maior que o total."] },
    };
  }

  let orderId = "";
  let numero = "";
  let falta = 0;

  try {
    const criado = await prisma.$transaction(async (tx) => {
      let clienteId = d.clienteId ?? null;
      if (clienteId) {
        const existe = await tx.cliente.findUnique({
          where: { id: clienteId },
          select: { id: true },
        });
        if (!existe) throw new Error("Cliente selecionado não existe mais.");
      } else {
        const novo = await tx.cliente.create({
          data: { nome: d.nome, telefone: soDigitos(d.telefone) || null },
          select: { id: true },
        });
        clienteId = novo.id;
      }

      const ano = data.getUTCFullYear();
      const ultimo = await tx.order.findFirst({
        where: { ano },
        orderBy: { sequencia: "desc" },
        select: { sequencia: true },
      });
      const sequencia = (ultimo?.sequencia ?? 0) + 1;

      const order = await tx.order.create({
        data: {
          numero: `#${ano}-${String(sequencia).padStart(4, "0")}`,
          ano,
          sequencia,
          clienteId,
          origem: "DISTRIBUIDOR",
          status: "ENTREGUE",
          tipoEntrega: "RETIRADA",
          formaPagamento: FORMA_PEDIDO[d.formaPagamento],
          observacoes: d.observacoes || null,
          enderecoEntrega: {
            nome: d.nome,
            telefone: soDigitos(d.telefone) || null,
          } as unknown as Prisma.InputJsonValue,
          subtotal,
          desconto,
          total,
          enviadoEm: data,
          criadoEm: data,
          items: { create: itens },
        },
        select: { id: true, numero: true },
      });

      if (d.valorPago > 0) {
        await registrarRecebimentoDistribuidor(tx, {
          orderId: order.id,
          valor: d.valorPago,
          data,
          forma: d.formaPagamento,
          criadoPorId: membro.id,
        });
      }
      const resta = await sincronizarSaldoDistribuidor(tx, order.id, vencimento);
      return { ...order, resta };
    });
    orderId = criado.id;
    numero = criado.numero;
    falta = criado.resta;
  } catch (e) {
    console.error("[distribuidor] criar", e);
    return {
      success: false,
      error:
        e instanceof Error && e.message.includes("não existe")
          ? e.message
          : "Não foi possível registrar o pedido.",
    };
  }

  await auditar(membro, {
    acao: "pedido.criar",
    entidade: "Order",
    entidadeId: orderId,
    descricao: `Registrou pedido de distribuidor ${numero} (${d.nome}) de ${total.toFixed(2)}, pago ${d.valorPago.toFixed(2)}`,
    depois: { total, pago: d.valorPago, falta, itens: itens.length },
  });

  revalidar(orderId);
  return { success: true, orderId, numero, falta };
}

/** Mais uma parte paga pelo distribuidor: entra no caixa e o saldo diminui. */
export async function registrarPagamentoDistribuidor(
  input: unknown,
): Promise<ActionResult> {
  const membro = await assertPermissao("financeiro.gerenciar");
  assertSegmento(membro, "PEIXES_VIVOS");

  const parsed = recebimentoDistribuidorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Confira o valor e a data." };
  }
  const { orderId, valor, formaPagamento } = parsed.data;
  const data = dataDoDia(parsed.data.data);
  if (!data) return { success: false, error: "Data inválida." };

  let falta = 0;
  try {
    falta = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { origem: true },
      });
      if (!order || order.origem !== "DISTRIBUIDOR") {
        throw new Error("Pedido de distribuidor não encontrado.");
      }
      const antes = await sincronizarSaldoDistribuidor(tx, orderId);
      if (valor > antes + 0.001) {
        throw new Error(`O valor passa do que falta (${antes.toFixed(2)}).`);
      }
      await registrarRecebimentoDistribuidor(tx, {
        orderId,
        valor,
        data,
        forma: formaPagamento,
        criadoPorId: membro.id,
      });
      return sincronizarSaldoDistribuidor(tx, orderId);
    });
  } catch (e) {
    console.error("[distribuidor] receber", e);
    return {
      success: false,
      // Só as mensagens escritas aqui vão para a tela; erro de banco não.
      error:
        e instanceof Error && /^(O valor|Pedido de distribuidor)/.test(e.message)
          ? e.message
          : "Não foi possível registrar o pagamento.",
    };
  }

  await auditar(membro, {
    acao: "financeiro.lancar",
    entidade: "Order",
    entidadeId: orderId,
    descricao: `Recebeu ${valor.toFixed(2)} de distribuidor (falta ${falta.toFixed(2)})`,
    depois: { valor, falta, data: parsed.data.data },
  });

  revalidar(orderId);
  return {
    success: true,
    message: falta > 0 ? `Pagamento lançado. Falta ${falta.toFixed(2).replace(".", ",")}.` : "Pedido quitado.",
  };
}
