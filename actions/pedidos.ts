"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  pedidoSchema,
  type ItemPedidoInput,
  type EnderecoEntrega,
} from "@/lib/validations/pedido";
import { TRANSICOES_PEDIDO, podeEditarItens } from "@/lib/pedido-status";
import { transicionarParaPago, ajustarPoolEstoque } from "@/lib/pedido-baixa";
import { gravarEnvioTx } from "@/lib/pedido-envio";
import { aplicarEstornoPedido } from "@/lib/pagamento-estorno";
import { registrarDevolucaoDeVenda } from "@/lib/financeiro/venda-no-caixa";
import { getPaymentProvider } from "@/lib/payments/registry";
import {
  notificarPedidoEnviado,
  notificarPedidoEntregue,
  notificarPedidoCancelado,
  notificarEstorno,
  notificarLoteEnviado,
} from "@/lib/notificacoes";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import type {
  Prisma,
  OrderStatus,
  Transportadora,
} from "@/lib/generated/prisma/client";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import {
  checarDescontoDoPedido,
  checarLimiteValor,
} from "@/lib/permissoes";
import { type ActionResult, isPrismaError } from "@/lib/utils/action-result";

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
  const membro = await assertPermissao("pedidos.editar");

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

  const foraDoLimite = checarDescontoDoPedido(membro, subtotal, data.desconto);
  if (foraDoLimite) return { success: false, error: foraDoLimite };

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

  await auditar(membro, {
    acao: "pedido.criar",
    entidade: "Order",
    entidadeId: novoId,
    descricao: `Criou um pedido de ${total.toFixed(2)}`,
    depois: { subtotal, frete: data.frete, desconto: data.desconto, total },
  });

  revalidatePath("/admin/pedidos");
  redirect(`/admin/pedidos/${novoId}`);
}

export async function updatePedido(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");

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

  const foraDoLimite = checarDescontoDoPedido(membro, subtotal, data.desconto);
  if (foraDoLimite) return { success: false, error: foraDoLimite };

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

  await auditar(membro, {
    acao: "pedido.atualizar",
    entidade: "Order",
    entidadeId: id,
    descricao: "Editou os itens/valores de um pedido",
    depois: { subtotal, frete: data.frete, desconto: data.desconto, total },
  });

  revalidatePath("/admin/pedidos");
  redirect(`/admin/pedidos/${id}`);
}

export async function deletePedido(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.excluir");
  const alvo = await prisma.order.findUnique({
    where: { id },
    select: { numero: true, total: true, status: true },
  });

  try {
    await prisma.order.delete({ where: { id } }); // cascata: itens + pagamentos
  } catch (e) {
    if (isPrismaError(e) && e.code === "P2025") {
      return { success: false, error: "Pedido não encontrado." };
    }
    console.error(e);
    return { success: false, error: "Erro ao excluir o pedido." };
  }

  await auditar(membro, {
    acao: "pedido.excluir",
    entidade: "Order",
    entidadeId: id,
    descricao: `Excluiu o pedido ${alvo?.numero ?? id}`,
    antes: alvo
      ? { numero: alvo.numero, total: alvo.total, status: alvo.status }
      : undefined,
  });

  await auditar(membro, {
    acao: "pedido.excluir",
    entidade: "Order",
    entidadeId: id,
    descricao: `Excluiu o pedido ${alvo?.numero ?? id}`,
    antes: alvo
      ? { numero: alvo.numero, total: alvo.total, status: alvo.status }
      : undefined,
  });

  revalidatePath("/admin/pedidos");
  return { success: true, message: "Pedido excluído." };
}

export async function atualizarStatusPedido(
  id: string,
  novoStatus: OrderStatus,
): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.status");

  const atual = await prisma.order.findUnique({
    where: { id },
    select: { status: true, estoqueBaixado: true, total: true },
  });
  if (!atual) return { success: false, error: "Pedido não encontrado." };

  if (!TRANSICOES_PEDIDO[atual.status].includes(novoStatus)) {
    return {
      success: false,
      error: `Transição inválida: ${atual.status} → ${novoStatus}.`,
    };
  }

  // Cancelar é a operação que desfaz venda: exige a permissão explícita do membro.
  // Se o pedido já foi PAGO, o teto em R$ também vale — aí tem dinheiro do cliente
  // no meio, não só um rascunho abandonado.
  if (novoStatus === "CANCELADO") {
    if (!membro.semLimites && !membro.podeCancelarPedido) {
      return {
        success: false,
        error: "Seu perfil não pode cancelar pedidos. Peça a um administrador.",
      };
    }
    if (atual.status === "PAGO") {
      const foraDoLimite = checarLimiteValor(
        membro,
        Number(atual.total),
        "cancelar pedido pago",
      );
      if (foraDoLimite) return { success: false, error: foraDoLimite };
    }
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

      // Cancelar tira a venda do caixa (ou lança a devolução, se já contava).
      // Vale para qualquer cancelamento, com ou sem estorno no gateway.
      if (novoStatus === "CANCELADO") {
        await registrarDevolucaoDeVenda(tx, id);
      }
    });
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao atualizar o status." };
  }

  // Notificações (após a transição persistir; helpers nunca lançam). PAGO não
  // notifica aqui — é confirmação manual do dono / o gateway já avisa.
  if (novoStatus === "ENVIADO") await notificarPedidoEnviado(id);
  else if (novoStatus === "ENTREGUE") await notificarPedidoEntregue(id);
  else if (novoStatus === "CANCELADO") await notificarPedidoCancelado(id);

  await auditar(membro, {
    acao: `pedido.status.${novoStatus.toLowerCase()}`,
    entidade: "Order",
    entidadeId: id,
    descricao: `Mudou o pedido de ${atual.status} para ${novoStatus}`,
    antes: { status: atual.status },
    depois: { status: novoStatus },
  });

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  return { success: true, message: "Status atualizado." };
}

const TRANSPORTADORAS_VALIDAS = ["JADLOG", "GOLLOG", "OUTRO"];

/**
 * Registra o envio MANUAL de um pedido PAGO (código digitado — Gollog, ou fallback
 * quando a etiqueta foi comprada fora do site). ATÔMICO: grava transportadora +
 * código + enviadoEm + status ENVIADO e cria o RastreioEvento + a Notificacao do
 * cliente na MESMA transação (mesmo estado final do fluxo automático de etiqueta).
 * Respeita a máquina de estados (só a partir de PAGO).
 */
export async function registrarEnvioManual(
  id: string,
  input: { transportadora: string; codigo: string },
): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.envio");

  if (!TRANSPORTADORAS_VALIDAS.includes(input.transportadora)) {
    return { success: false, error: "Transportadora inválida." };
  }
  const transportadora = input.transportadora as Transportadora;
  const codigo = (input.codigo ?? "").trim();
  if (transportadora !== "OUTRO" && !codigo) {
    return { success: false, error: "Informe o código de rastreio." };
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true, numero: true, clienteId: true, userId: true },
  });
  if (!order) return { success: false, error: "Pedido não encontrado." };
  if (!TRANSICOES_PEDIDO[order.status].includes("ENVIADO")) {
    return {
      success: false,
      error: `Só dá para registrar envio a partir de PAGO (status atual: ${order.status}).`,
    };
  }

  try {
    await prisma.$transaction((tx) =>
      gravarEnvioTx(tx, {
        id,
        numero: order.numero,
        clienteId: order.clienteId,
        userId: order.userId,
        transportadora,
        codigo: codigo || null,
      }),
    );
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao registrar o envio." };
  }

  await auditar(membro, {
    acao: "pedido.enviar",
    entidade: "Order",
    entidadeId: id,
    descricao: `Registrou envio por ${transportadora}${codigo ? ` (${codigo})` : ""}`,
    depois: { transportadora, codigo },
  });

  await notificarPedidoEnviado(id); // 🚚 (com transportadora + rastreio)

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  return {
    success: true,
    message: "Envio registrado. Pedido marcado como enviado.",
  };
}

/**
 * Corrige o rastreio de um pedido JÁ enviado (erro de digitação). NÃO mexe no
 * status nem cria evento/notificação — é só correção.
 */
export async function atualizarRastreio(
  id: string,
  input: { transportadora: string; codigo: string },
): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.envio");

  if (!TRANSPORTADORAS_VALIDAS.includes(input.transportadora)) {
    return { success: false, error: "Transportadora inválida." };
  }
  const transportadora = input.transportadora as Transportadora;
  const codigo = (input.codigo ?? "").trim();

  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!order) return { success: false, error: "Pedido não encontrado." };
  if (order.status !== "ENVIADO" && order.status !== "ENTREGUE") {
    return { success: false, error: "Este pedido ainda não foi enviado." };
  }

  try {
    await prisma.order.update({
      where: { id },
      data: { transportadora, codigoRastreio: codigo || null },
    });
  } catch (e) {
    console.error(e);
    return { success: false, error: "Erro ao atualizar o rastreio." };
  }

  await auditar(membro, {
    acao: "pedido.rastreio",
    entidade: "Order",
    entidadeId: id,
    descricao: `Alterou o rastreio para ${input.codigo}`,
    depois: { transportadora: input.transportadora, codigo: input.codigo },
  });

  revalidatePath(`/admin/pedidos/${id}`);
  return { success: true, message: "Rastreio atualizado." };
}

// ── Envio rápido em LOTE (listagem) ───────────────────────────────────────────
const marcarEnviadosSchema = z.object({
  envios: z
    .array(
      z.object({
        pedidoId: z.string().min(1),
        codigoRastreio: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
});

export type EnvioResultado = {
  pedidoId: string;
  numero: string;
  sucesso: boolean;
  erro?: string;
};

/**
 * Marca vários pedidos como ENVIADO de uma vez (cada um com seu código opcional).
 * Processa pedido a pedido em transações independentes — a falha de um NÃO derruba
 * os outros. A transportadora de cada pedido é mantida (o lote não a altera).
 * Telegram: 1 sucesso → 🚚 individual; 2+ → uma mensagem de lote agregada.
 */
export async function marcarPedidosComoEnviados(input: {
  envios: { pedidoId: string; codigoRastreio?: string }[];
}): Promise<{ ok: boolean; resultados: EnvioResultado[] }> {
  const membro = await assertPermissao("pedidos.envio");

  const parsed = marcarEnviadosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, resultados: [] };

  const resultados: EnvioResultado[] = [];
  const idsSucesso: string[] = [];
  const sucessos: {
    numero: string;
    cliente: string;
    cidade: string | null;
    uf: string | null;
    rastreio: string | null;
  }[] = [];

  for (const envio of parsed.data.envios) {
    const codigo = (envio.codigoRastreio ?? "").trim() || null;
    const order = await prisma.order.findUnique({
      where: { id: envio.pedidoId },
      select: {
        id: true,
        numero: true,
        status: true,
        clienteId: true,
        userId: true,
        transportadora: true,
        enderecoEntrega: true,
        cliente: { select: { nome: true } },
      },
    });
    if (!order) {
      resultados.push({
        pedidoId: envio.pedidoId,
        numero: "?",
        sucesso: false,
        erro: "Pedido não encontrado.",
      });
      continue;
    }
    if (!TRANSICOES_PEDIDO[order.status].includes("ENVIADO")) {
      resultados.push({
        pedidoId: order.id,
        numero: order.numero,
        sucesso: false,
        erro: `Transição inválida (status ${order.status}).`,
      });
      continue;
    }
    try {
      await prisma.$transaction((tx) =>
        gravarEnvioTx(tx, {
          id: order.id,
          numero: order.numero,
          clienteId: order.clienteId,
          userId: order.userId,
          transportadora: order.transportadora,
          codigo,
        }),
      );
      resultados.push({ pedidoId: order.id, numero: order.numero, sucesso: true });
      idsSucesso.push(order.id);
      const e = (order.enderecoEntrega ?? {}) as {
        cidade?: string | null;
        uf?: string | null;
      };
      sucessos.push({
        numero: order.numero,
        cliente: order.cliente.nome,
        cidade: e.cidade ?? null,
        uf: e.uf ?? null,
        rastreio: codigo,
      });
    } catch (err) {
      console.error("[pedidos] marcarPedidosComoEnviados", err);
      resultados.push({
        pedidoId: order.id,
        numero: order.numero,
        sucesso: false,
        erro: "Erro ao registrar o envio.",
      });
    }
  }

  // Telegram: individual (1) ou lote agregado (2+). Sempre após persistir.
  if (idsSucesso.length === 1) await notificarPedidoEnviado(idsSucesso[0]);
  else if (idsSucesso.length >= 2) await notificarLoteEnviado(sucessos);

  revalidatePath("/admin/pedidos");
  return { ok: true, resultados };
}

/**
 * Estorno TOTAL no gateway (Mercado Pago OU PagBank) + convergência no sistema.
 * Admin-only. É DINHEIRO: o valor vem do banco (nunca do client) e a idempotência
 * é dupla — chave de idempotência estável no gateway + trava estornadoEm na rotina
 * compartilhada (mesma do webhook). Se o gateway falhar, NÃO marca como estornado
 * (mensagem clara). Clicar 2× é seguro. O provider é resolvido pelo pagamento pago.
 */
export async function estornarPedido(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.status");
  if (!membro.semLimites && !membro.podeEstornar) {
    return {
      success: false,
      error: "Seu perfil não pode estornar pagamentos. Peça a um administrador.",
    };
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      pagamentos: {
        select: {
          id: true,
          provider: true,
          status: true,
          externalId: true,
          estornadoEm: true,
          valor: true,
        },
      },
    },
  });
  if (!order) return { success: false, error: "Pedido não encontrado." };

  // Já estornado → sucesso idempotente (não chama o gateway de novo).
  if (order.pagamentos.some((p) => p.estornadoEm != null)) {
    return { success: true, message: "Este pedido já foi estornado." };
  }

  // Pagamento que de fato moveu dinheiro (PAGO) com id no gateway.
  const pago = order.pagamentos.find(
    (p) => p.status === "PAGO" && p.externalId,
  );
  if (!pago?.externalId) {
    return {
      success: false,
      error: "Não há pagamento aprovado neste pedido para estornar.",
    };
  }

  // Teto em R$ sobre o valor que realmente saiu da mão do cliente (vem do banco).
  const foraDoLimite = checarLimiteValor(membro, Number(pago.valor), "estorno");
  if (foraDoLimite) return { success: false, error: foraDoLimite };

  // 1) Estorna no gateway FORA da transação de DB. Idempotency-key estável dedup no
  //    gateway. Se falhar, retorna a mensagem e NÃO marca como estornado.
  let refundId: string | null = null;
  try {
    const provider = getPaymentProvider(pago.provider);
    const r = await provider.estornarPagamento(pago.externalId, {
      idempotencyKey: `refund-${pago.externalId}`,
    });
    refundId = r.refundId;
  } catch (e) {
    console.error("[estorno] gateway", e);
    return {
      success: false,
      error:
        e instanceof Error
          ? e.message
          : "Não foi possível estornar no gateway de pagamento.",
    };
  }

  // 2) Converge no sistema (marca estornado + reverte estoque), idempotente.
  try {
    await prisma.$transaction((tx) =>
      aplicarEstornoPedido(tx, {
        orderId: id,
        pagamentoId: pago.id,
        refundId,
      }),
    );
  } catch (e) {
    console.error("[estorno] aplicar", e);
    return {
      success: false,
      error:
        "O estorno foi feito no Mercado Pago, mas houve um erro ao atualizar o pedido. Atualize a página.",
    };
  }

  await notificarEstorno(id, Number(pago.valor)); // ↩️ (valor do banco)

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  return {
    success: true,
    message:
      "Pedido estornado. O valor volta ao meio de pagamento do cliente; no cartão, aparece na fatura.",
  };
}
