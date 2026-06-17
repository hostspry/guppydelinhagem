"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  pedidoSchema,
  type ItemPedidoInput,
  type EnderecoEntrega,
} from "@/lib/validations/pedido";
import { TRANSICOES_PEDIDO, podeEditarItens } from "@/lib/pedido-status";
import { transicionarParaPago, ajustarPoolEstoque } from "@/lib/pedido-baixa";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import type { Prisma, OrderStatus } from "@/lib/generated/prisma/client";
import {
  type ActionResult,
  assertAuthorized,
  isPrismaError,
} from "@/lib/utils/action-result";

const round2 = (n: number) => Math.round(n * 100) / 100;
const nullify = (s: FormDataEntryValue | null) => {
  const t = (s ?? "").toString().trim();
  return t === "" ? null : t;
};

function parsePedidoForm(formData: FormData) {
  let itens: unknown = [];
  try {
    itens = JSON.parse(String(formData.get("itens") ?? "[]"));
  } catch {
    itens = [];
  }
  return pedidoSchema.safeParse({
    clienteId: formData.get("clienteId"),
    itens,
    frete: formData.get("frete"),
    desconto: formData.get("desconto"),
    formaPagamento: formData.get("formaPagamento"),
    transportadora: formData.get("transportadora"),
    observacoes: formData.get("observacoes"),
  });
}

/** Snapshot do destinatário a partir do Cliente (null se o cliente não existir). */
async function snapshotEndereco(
  clienteId: string,
): Promise<EnderecoEntrega | null> {
  const c = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!c) return null;
  return {
    nome: c.nome,
    cpfCnpj: c.cpfCnpj,
    telefone: c.telefone,
    email: c.email,
    cep: c.cep,
    logradouro: c.logradouro,
    numero: c.numero,
    complemento: c.complemento,
    bairro: c.bairro,
    cidade: c.cidade,
    uf: c.uf,
  };
}

/**
 * Constrói os itens a gravar com SNAPSHOTS: catálogo → nome autoritativo do
 * produto + thumbnail; avulso (ou produto removido) → dados digitados. O preço
 * unitário é sempre o enviado (editável).
 */
async function buildItens(itens: ItemPedidoInput[]) {
  const ids = itens
    .map((i) => i.produtoId)
    .filter((x): x is string => !!x);
  const produtos = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          nome: true,
          videos: {
            where: { principal: true },
            take: 1,
            select: { thumbnailUrl: true },
          },
          variantes: {
            where: { ativo: true },
            select: { composicao: true, qtdMachos: true, qtdFemeas: true },
          },
        },
      })
    : [];
  const map = new Map(produtos.map((p) => [p.id, p]));

  return itens.map((i) => {
    const prod = i.produtoId ? map.get(i.produtoId) : undefined;
    // Receita vem da variante (autoritativa), não do que o cliente enviou.
    const variante =
      prod && i.composicao
        ? prod.variantes.find((v) => v.composicao === i.composicao)
        : undefined;
    const nomeBase = prod ? prod.nome : i.nomeProduto;
    return {
      productId: prod ? i.produtoId : null, // coluna real é productId; inexistente → avulso
      nomeProduto: variante
        ? `${nomeBase} — ${COMPOSICAO_LABEL[variante.composicao]}`
        : nomeBase,
      precoUnitario: i.precoUnitario,
      quantidade: i.quantidade,
      imagemSnapshot: prod?.videos[0]?.thumbnailUrl ?? null,
      composicao: variante ? variante.composicao : null,
      qtdMachos: variante ? variante.qtdMachos : null,
      qtdFemeas: variante ? variante.qtdFemeas : null,
    };
  });
}

function calcTotais(
  itens: { precoUnitario: number; quantidade: number }[],
  frete: number,
  desconto: number,
) {
  const subtotal = round2(
    itens.reduce((s, it) => s + it.precoUnitario * it.quantidade, 0),
  );
  const total = round2(subtotal + frete - desconto);
  return { subtotal, total };
}

export async function createPedido(formData: FormData): Promise<ActionResult> {
  await assertAuthorized();

  const parsed = parsePedidoForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const endereco = await snapshotEndereco(data.clienteId);
  if (!endereco) return { success: false, error: "Cliente não encontrado." };

  const itensData = await buildItens(data.itens);
  const { subtotal, total } = calcTotais(itensData, data.frete, data.desconto);

  let novoId = "";
  try {
    const order = await prisma.$transaction(async (tx) => {
      const ano = new Date().getFullYear();
      const ultimo = await tx.order.findFirst({
        where: { ano },
        orderBy: { sequencia: "desc" },
        select: { sequencia: true },
      });
      const sequencia = (ultimo?.sequencia ?? 0) + 1;
      const numero = `#${ano}-${String(sequencia).padStart(4, "0")}`;

      return tx.order.create({
        data: {
          numero,
          ano,
          sequencia,
          clienteId: data.clienteId,
          formaPagamento: data.formaPagamento ?? null,
          transportadora: data.transportadora ?? null,
          observacoes: nullify(data.observacoes ?? null),
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          subtotal,
          frete: data.frete,
          desconto: data.desconto,
          total,
          items: { create: itensData },
        },
        select: { id: true },
      });
    });
    novoId = order.id;
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao salvar o pedido." };
  }

  revalidatePath("/admin/pedidos");
  redirect(`/admin/pedidos/${novoId}`);
}

export async function updatePedido(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  await assertAuthorized();

  const atual = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!atual) return { success: false, error: "Pedido não encontrado." };
  if (!podeEditarItens(atual.status)) {
    return {
      success: false,
      error: "Pedido pago/enviado não pode mais ter os itens editados.",
    };
  }

  const parsed = parsePedidoForm(formData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  const endereco = await snapshotEndereco(data.clienteId);
  if (!endereco) return { success: false, error: "Cliente não encontrado." };

  const itensData = await buildItens(data.itens);
  const { subtotal, total } = calcTotais(itensData, data.frete, data.desconto);

  try {
    // Reconcilia itens por substituição total (não há referência externa a item).
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { orderId: id } }),
      prisma.order.update({
        where: { id },
        data: {
          clienteId: data.clienteId,
          formaPagamento: data.formaPagamento ?? null,
          transportadora: data.transportadora ?? null,
          observacoes: nullify(data.observacoes ?? null),
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          subtotal,
          frete: data.frete,
          desconto: data.desconto,
          total,
          items: { create: itensData },
        },
      }),
    ]);
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Pedido não encontrado." };
    }
    console.error(e);
    return { success: false, error: "Erro ao salvar o pedido." };
  }

  revalidatePath("/admin/pedidos");
  redirect(`/admin/pedidos/${id}`);
}

export async function deletePedido(id: string): Promise<ActionResult> {
  await assertAuthorized();

  try {
    await prisma.order.delete({ where: { id } }); // cascata: itens + pagamentos
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Pedido não encontrado." };
    }
    console.error(e);
    return { success: false, error: "Erro ao excluir o pedido." };
  }

  revalidatePath("/admin/pedidos");
  return { success: true, message: "Pedido excluído." };
}

export async function atualizarStatusPedido(
  id: string,
  novoStatus: OrderStatus,
): Promise<ActionResult> {
  await assertAuthorized();

  const atual = await prisma.order.findUnique({
    where: { id },
    select: { status: true, estoqueBaixado: true },
  });
  if (!atual) return { success: false, error: "Pedido não encontrado." };

  if (!TRANSICOES_PEDIDO[atual.status].includes(novoStatus)) {
    return {
      success: false,
      error: `Transição inválida: ${atual.status} → ${novoStatus}.`,
    };
  }

  // PAGO → transição + baixa do pool (uma vez, trava estoqueBaixado), via função
  // COMPARTILHADA com o webhook do MP. CANCELADO de pedido já baixado → estorna o
  // pool. ENVIADO/ENTREGUE não mexem no estoque. Permite pool negativo.
  try {
    await prisma.$transaction(async (tx) => {
      if (novoStatus === "PAGO") {
        await transicionarParaPago(tx, id); // status + baixa idempotente
        return;
      }

      await tx.order.update({ where: { id }, data: { status: novoStatus } });

      if (novoStatus === "CANCELADO" && atual.estoqueBaixado) {
        await ajustarPoolEstoque(tx, id, 1); // estorna a baixa anterior
        await tx.order.update({
          where: { id },
          data: { estoqueBaixado: false },
        });
      }
    });
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao atualizar o status." };
  }

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  return { success: true, message: "Status atualizado." };
}
