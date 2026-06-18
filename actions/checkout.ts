"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkoutSchema,
  type CheckoutInput,
  type CheckoutFormInput,
} from "@/lib/validations/checkout";
import { calcularPesoECaixa, cotarFrete } from "@/lib/shipping";
import { getPaymentProvider } from "@/lib/payments/registry";
import { mensagemRecusa } from "@/lib/payments/mercadopago";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import { COMPOSICAO_LABEL } from "@/lib/composicoes";
import { MAX_PEIXES_POR_CAIXA } from "@/lib/constants";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import {
  ProviderPagamento,
  MetodoPagamento,
  StatusPagamento,
  FormaPagamento,
  Transportadora,
} from "@/lib/generated/prisma/enums";
import type { Prisma, OrderStatus } from "@/lib/generated/prisma/client";

const TETO_PARCELAS = 12;

const round2 = (n: number) => Math.round(n * 100) / 100;

export type CheckoutPixData = {
  numero: string;
  valor: number;
  qrCodeBase64: string | null;
  copiaECola: string | null;
  ticketUrl: string | null;
  expiraEm: string | null; // ISO
};

export type CheckoutResult =
  | { ok: true; data: CheckoutPixData }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Emite a cobrança Pix no MP e grava a linha Pagamento + amarra o id no pedido.
 * Reusado por criarPedidoCheckout e gerarNovoPix. Lança se o MP falhar (o
 * chamador decide o que fazer com o pedido); falha ao gravar a linha Pagamento é
 * só logada (o Pix já existe no MP, não dá pra perder o QR pro cliente).
 */
async function emitirPix(args: {
  orderId: string;
  numero: string;
  valor: number;
  pagador: {
    nome?: string | null;
    sobrenome?: string | null;
    email: string;
    cpfCnpj?: string | null;
  };
}): Promise<CheckoutPixData> {
  const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
  const pix = await provider.criarPagamentoPix({
    orderId: args.orderId,
    valor: args.valor,
    descricao: `Pedido ${args.numero} — Guppy de Linhagem`,
    pagador: args.pagador,
  });

  try {
    await prisma.pagamento.create({
      data: {
        orderId: args.orderId,
        provider: ProviderPagamento.MERCADO_PAGO,
        metodo: MetodoPagamento.PIX,
        status:
          pix.status === StatusPagamento.PAGO
            ? StatusPagamento.PAGO
            : StatusPagamento.PENDENTE,
        valor: args.valor,
        externalId: pix.externalId,
        qrCode: pix.qrCode, // copia-e-cola (EMV)
        linkPagamento: pix.ticketUrl,
        payloadRaw: {
          qrCodeBase64: pix.qrCodeBase64,
          ticketUrl: pix.ticketUrl,
          expiraEm: pix.expiraEm ? pix.expiraEm.toISOString() : null,
        } as Prisma.InputJsonValue,
      },
    });
    await prisma.order.update({
      where: { id: args.orderId },
      data: { mpPaymentId: pix.externalId },
    });
  } catch (e) {
    console.error("[checkout] gravar Pagamento", e);
  }

  return {
    numero: args.numero,
    valor: args.valor,
    qrCodeBase64: pix.qrCodeBase64,
    copiaECola: pix.copiaECola ?? pix.qrCode,
    ticketUrl: pix.ticketUrl,
    expiraEm: pix.expiraEm ? pix.expiraEm.toISOString() : null,
  };
}

export type PagadorCheckout = {
  nome: string;
  sobrenome: string | null;
  email: string;
  cpfCnpj: string;
};

export type OrderCriado = {
  orderId: string;
  numero: string;
  valor: number; // total recalculado no servidor
  pagador: PagadorCheckout;
};

type OrderResult =
  | { ok: true; data: OrderCriado }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Cria o Order do checkout público (guest) — COMPARTILHADO entre Pix e Cartão.
 *
 * Anti-fraude: o PREÇO de cada item e o FRETE são recalculados NO SERVIDOR a
 * partir do banco e da cotadora — nunca confia no que o client mandou. Cria/reusa
 * Cliente, cria Order AGUARDANDO_PAGAMENTO (sem baixar estoque — só no PAGO).
 * NÃO gera pagamento: devolve { orderId, numero, valor, pagador } pro chamador
 * (Pix ou Cartão) emitir a cobrança. Se a emissão falhar, o chamador remove o
 * pedido órfão.
 */
export async function criarOrderDoCheckout(
  input: CheckoutFormInput,
): Promise<OrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os dados do formulário.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;

  // ── 1. Recalcular preços do banco (ignora o preço do client) ──────────────
  const produtoIds = [...new Set(data.itens.map((i) => i.produtoId))];
  const produtos = await prisma.product.findMany({
    where: { id: { in: produtoIds }, ativo: true },
    select: {
      id: true,
      nome: true,
      preco: true,
      videos: {
        where: { principal: true },
        take: 1,
        select: { thumbnailUrl: true },
      },
      variantes: {
        where: { ativo: true },
        select: {
          composicao: true,
          preco: true,
          qtdMachos: true,
          qtdFemeas: true,
        },
      },
    },
  });
  const pmap = new Map(produtos.map((p) => [p.id, p]));

  const itensData: {
    productId: string;
    nomeProduto: string;
    precoUnitario: number;
    quantidade: number;
    imagemSnapshot: string | null;
    composicao: CheckoutInput["itens"][number]["composicao"];
    qtdMachos: number | null;
    qtdFemeas: number | null;
  }[] = [];
  let totalPeixes = 0;

  for (const item of data.itens) {
    const prod = pmap.get(item.produtoId);
    if (!prod) {
      return { ok: false, error: "Um dos produtos não está mais disponível." };
    }

    if (item.composicao) {
      const variante = prod.variantes.find(
        (v) => v.composicao === item.composicao,
      );
      if (!variante) {
        return {
          ok: false,
          error: `A composição escolhida de "${prod.nome}" não está mais disponível.`,
        };
      }
      const qtdPeixes = variante.qtdMachos + variante.qtdFemeas;
      totalPeixes += qtdPeixes * item.quantidade;
      itensData.push({
        productId: prod.id,
        nomeProduto: `${prod.nome} — ${COMPOSICAO_LABEL[item.composicao]}`,
        precoUnitario: Number(variante.preco), // PREÇO DO BANCO
        quantidade: item.quantidade,
        imagemSnapshot: prod.videos[0]?.thumbnailUrl ?? null,
        composicao: item.composicao,
        qtdMachos: variante.qtdMachos,
        qtdFemeas: variante.qtdFemeas,
      });
    } else {
      // Não-peixe (sem composição): usa Product.preco.
      itensData.push({
        productId: prod.id,
        nomeProduto: prod.nome,
        precoUnitario: Number(prod.preco),
        quantidade: item.quantidade,
        imagemSnapshot: prod.videos[0]?.thumbnailUrl ?? null,
        composicao: null,
        qtdMachos: null,
        qtdFemeas: null,
      });
    }
  }

  // >10 peixes → não dá pra cobrar frete automático: fecha no WhatsApp.
  if (totalPeixes > MAX_PEIXES_POR_CAIXA) {
    return {
      ok: false,
      error: `Pedidos acima de ${MAX_PEIXES_POR_CAIXA} peixes têm o frete calculado manualmente — finalize no WhatsApp.`,
    };
  }

  const subtotal = round2(
    itensData.reduce((s, it) => s + it.precoUnitario * it.quantidade, 0),
  );

  // ── 2. Re-cotar o frete no servidor (anti-tamper) ─────────────────────────
  // Só Jadlog é auto-cobrável; Gollog é faixa/manual. Re-cota pra esse CEP+peso.
  const { pesoGramas, caixa } = calcularPesoECaixa(Math.max(1, totalPeixes));
  const cot = await cotarFrete({ cepDestino: data.cep, pesoGramas, caixa });
  if (!cot.ok) {
    return { ok: false, error: cot.error };
  }
  const jad = cot.data.jadlog.find((j) => j.id === 4) ?? cot.data.jadlog[0];
  if (!jad) {
    return {
      ok: false,
      error:
        "Não há frete automático para esse CEP. Finalize no WhatsApp para combinarmos o envio.",
    };
  }
  if (jad.requerAvaliacao) {
    return {
      ok: false,
      error:
        "O prazo de entrega para esse CEP exige avaliação — finalize no WhatsApp.",
    };
  }
  const frete = round2(jad.price);
  const total = round2(subtotal + frete);

  // ── 3. Cliente (guest): cria/reusa por CPF, depois email, depois telefone ──
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const cpf = data.cpfCnpj;
  const tel = data.telefone;

  const endereco: EnderecoEntrega = {
    nome: data.nome,
    cpfCnpj: cpf,
    telefone: tel,
    email: data.email,
    cep: data.cep,
    logradouro: data.logradouro,
    numero: data.numero,
    complemento: data.complemento || null,
    bairro: data.bairro,
    cidade: data.cidade,
    uf: data.uf.toUpperCase(),
  };

  let orderId = "";
  let numero = "";
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Reuso de cliente por identidade forte → fraca.
      const existente =
        (cpf && (await tx.cliente.findFirst({ where: { cpfCnpj: cpf } }))) ||
        (await tx.cliente.findFirst({ where: { email: data.email } })) ||
        (tel ? await tx.cliente.findFirst({ where: { telefone: tel } }) : null);

      const dadosCliente = {
        nome: data.nome,
        telefone: tel,
        email: data.email,
        cpfCnpj: cpf,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento || null,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf.toUpperCase(),
      };

      const cliente = existente
        ? await tx.cliente.update({
            where: { id: existente.id },
            data: {
              ...dadosCliente,
              // só vincula user se ainda não tiver
              ...(userId && !existente.userId ? { userId } : {}),
            },
            select: { id: true },
          })
        : await tx.cliente.create({
            data: { ...dadosCliente, ...(userId ? { userId } : {}) },
            select: { id: true },
          });

      // Número sequencial por ano (igual ao pedido manual).
      const ano = new Date().getFullYear();
      const ultimo = await tx.order.findFirst({
        where: { ano },
        orderBy: { sequencia: "desc" },
        select: { sequencia: true },
      });
      const sequencia = (ultimo?.sequencia ?? 0) + 1;
      const num = `#${ano}-${String(sequencia).padStart(4, "0")}`;

      const order = await tx.order.create({
        data: {
          numero: num,
          ano,
          sequencia,
          clienteId: cliente.id,
          userId: userId ?? undefined,
          status: "AGUARDANDO_PAGAMENTO", // sem baixar estoque (só no PAGO)
          formaPagamento: FormaPagamento.PIX,
          transportadora: Transportadora.JADLOG,
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          subtotal,
          frete,
          desconto: 0,
          total,
          items: { create: itensData },
        },
        select: { id: true, numero: true },
      });
      return order;
    });
    orderId = created.id;
    numero = created.numero;
  } catch (e) {
    console.error("[checkout] criar pedido", e);
    return { ok: false, error: "Não foi possível criar o pedido. Tente novamente." };
  }

  const partesNome = data.nome.trim().split(/\s+/);
  return {
    ok: true,
    data: {
      orderId,
      numero,
      valor: total,
      pagador: {
        nome: partesNome[0],
        sobrenome: partesNome.slice(1).join(" ") || null,
        email: data.email,
        cpfCnpj: cpf,
      },
    },
  };
}

/**
 * Pix: cria o Order (helper compartilhado) e gera a cobrança Pix. Se o MP falhar,
 * remove o pedido órfão. Devolve o QR/copia-e-cola pra tela do Pix.
 */
export async function criarPedidoCheckout(
  input: CheckoutFormInput,
): Promise<CheckoutResult> {
  const order = await criarOrderDoCheckout(input);
  if (!order.ok) return order;

  try {
    const pixData = await emitirPix({
      orderId: order.data.orderId,
      numero: order.data.numero,
      valor: order.data.valor,
      pagador: order.data.pagador,
    });
    return { ok: true, data: pixData };
  } catch (e) {
    console.error("[checkout] criar Pix", e);
    // Sem pagamento não há pedido útil → remove o rascunho pra não poluir o admin.
    await prisma.order.delete({ where: { id: order.data.orderId } }).catch(() => {});
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Não foi possível gerar o Pix agora.",
    };
  }
}

/**
 * Poll do status do pedido a partir do BANCO (o webhook é quem confirma o
 * pagamento e atualiza o status). NÃO chama o MP — público, leve, idempotente.
 * `pago` cobre PAGO e os status posteriores (ENVIADO/ENTREGUE).
 */
export async function consultarStatusPedido(
  numero: string,
): Promise<{ pago: boolean; status: OrderStatus } | null> {
  const order = await prisma.order.findUnique({
    where: { numero },
    select: { status: true },
  });
  if (!order) return null;
  const pago =
    order.status === "PAGO" ||
    order.status === "ENVIADO" ||
    order.status === "ENTREGUE";
  return { pago, status: order.status };
}

/**
 * Gera um novo Pix para um pedido que ainda aguarda pagamento (Pix anterior
 * expirou). Reusa o cliente/endereço/total do pedido — não recria o Order.
 */
export async function gerarNovoPix(numero: string): Promise<CheckoutResult> {
  const order = await prisma.order.findUnique({
    where: { numero },
    select: {
      id: true,
      numero: true,
      total: true,
      status: true,
      enderecoEntrega: true,
    },
  });
  if (!order) return { ok: false, error: "Pedido não encontrado." };
  if (order.status !== "AGUARDANDO_PAGAMENTO") {
    return {
      ok: false,
      error: "Este pedido não está mais aguardando pagamento.",
    };
  }

  const end = order.enderecoEntrega as unknown as EnderecoEntrega;
  const partes = (end.nome ?? "").trim().split(/\s+/);
  try {
    const pixData = await emitirPix({
      orderId: order.id,
      numero: order.numero,
      valor: Number(order.total),
      pagador: {
        nome: partes[0],
        sobrenome: partes.slice(1).join(" ") || null,
        email: end.email ?? "",
        cpfCnpj: end.cpfCnpj,
      },
    });
    return { ok: true, data: pixData };
  } catch (e) {
    console.error("[checkout] gerar novo Pix", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Não foi possível gerar o Pix.",
    };
  }
}

// ── Cartão de crédito ────────────────────────────────────────────────────────

export type CartaoInput = {
  token: string;
  paymentMethodId: string;
  issuerId: string | null;
  installments: number;
  // payer exatamente como o Brick devolveu (não reordenar/substituir): o
  // identification (CPF) é o que o cliente digitou no formulário seguro do MP.
  payer?: {
    email?: string | null;
    identification?: { type?: string | null; number?: string | null } | null;
  } | null;
};

export type CartaoDesfecho =
  | { resultado: "aprovado"; numero: string }
  | { resultado: "analise"; numero: string }
  | { resultado: "recusado"; mensagem: string }
  | {
      resultado: "erro";
      mensagem: string;
      fieldErrors?: Record<string, string[]>;
    };

/**
 * Teto de parcelas = min(12, menor parcelasMax entre os produtos do carrinho).
 * Calculado NO SERVIDOR — alimenta o Brick (maxInstallments) e valida a tentativa
 * (anti-tamper). Sem produtos → 1.
 */
export async function calcularTetoParcelas(
  produtoIds: string[],
): Promise<number> {
  const ids = [...new Set((produtoIds ?? []).filter(Boolean))];
  if (ids.length === 0) return 1;
  const prods = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { parcelasMax: true },
  });
  if (prods.length === 0) return 1;
  const menor = Math.min(...prods.map((p) => p.parcelasMax));
  return Math.max(1, Math.min(TETO_PARCELAS, menor));
}

/**
 * Cartão: cria o Order (helper compartilhado) e cobra no cartão com o TOKEN
 * (gerado no navegador pelo Brick — o servidor nunca vê PAN/CVV). Três desfechos
 * (status sempre da API do MP):
 *  - approved → grava Pagamento PAGO + transiciona o pedido (baixa com trava;
 *    o webhook depois não baixa de novo). Devolve "aprovado".
 *  - in_process → grava Pagamento EM_ANALISE, pedido segue AGUARDANDO (sem baixa);
 *    devolve "analise" (o webhook confirma depois).
 *  - rejected → grava Pagamento RECUSADO, pedido segue aguardando; devolve
 *    "recusado" + mensagem amigável (deixa tentar de novo).
 */
export async function pagarComCartao(
  input: CheckoutFormInput,
  cartao: CartaoInput,
): Promise<CartaoDesfecho> {
  // Valida o parcelamento ANTES de criar o pedido (anti-tamper, evita órfão).
  const parcelas = Number(cartao.installments);
  const teto = await calcularTetoParcelas(
    (input.itens ?? []).map((i) => i.produtoId),
  );
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > teto) {
    return { resultado: "erro", mensagem: "Opção de parcelamento inválida." };
  }
  if (!cartao.token || !cartao.paymentMethodId) {
    return { resultado: "erro", mensagem: "Dados do cartão incompletos." };
  }

  const order = await criarOrderDoCheckout(input);
  if (!order.ok) {
    return {
      resultado: "erro",
      mensagem: order.error,
      fieldErrors: order.fieldErrors,
    };
  }
  const { orderId, numero, valor, pagador } = order.data;

  // payer fiel ao Brick: usa o e-mail/CPF que vieram do formulário seguro do MP;
  // só cai no checkout se o Brick não devolver (ex.: campo oculto).
  const emailPagador = cartao.payer?.email || pagador.email;
  const cpfPagador =
    cartao.payer?.identification?.number || pagador.cpfCnpj;

  // Cobrança no cartão (fora de transação de DB, igual ao Pix). O token vai UMA
  // vez ao /v1/payments; numa nova tentativa o Brick gera token novo.
  let pago;
  try {
    const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
    pago = await provider.criarPagamentoCartao({
      orderId,
      valor,
      descricao: `Pedido ${numero} — Guppy de Linhagem`,
      token: cartao.token,
      paymentMethodId: cartao.paymentMethodId,
      issuerId: cartao.issuerId,
      installments: parcelas,
      pagador: { email: emailPagador, cpfCnpj: cpfPagador },
    });
  } catch (e) {
    console.error("[checkout] cobrar cartão", e);
    // Erro de comunicação → sem pagamento → remove o pedido órfão.
    await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    return {
      resultado: "erro",
      mensagem:
        e instanceof Error ? e.message : "Não foi possível processar o cartão.",
    };
  }

  // DIAGNÓSTICO: desfecho mapeado (correlaciona com o log cru do provider).
  console.log("[checkout] cartão desfecho", {
    numero,
    status: pago.status,
    statusDetail: pago.statusDetail,
    parcelas: pago.parcelas,
    bandeira: pago.bandeira,
  });

  // Grava a linha Pagamento em TODOS os casos (PAGO/EM_ANALISE/RECUSADO).
  try {
    await prisma.pagamento.create({
      data: {
        orderId,
        provider: ProviderPagamento.MERCADO_PAGO,
        metodo: MetodoPagamento.CARTAO,
        status: pago.status,
        valor,
        externalId: pago.externalId,
        parcelas: pago.parcelas,
        bandeira: pago.bandeira,
        // Só motivo da recusa (não sensível). NUNCA token/PAN/CVV.
        payloadRaw: { statusDetail: pago.statusDetail } as Prisma.InputJsonValue,
      },
    });
    await prisma.order.update({
      where: { id: orderId },
      data: { mpPaymentId: pago.externalId, parcelas: pago.parcelas },
    });
  } catch (e) {
    console.error("[checkout] gravar Pagamento cartão", e);
  }

  // ── Desfechos ──
  if (pago.status === StatusPagamento.PAGO) {
    // approved já vem na hora → transiciona aqui (trava evita baixa dupla quando
    // o webhook chegar com a mesma aprovação).
    try {
      await prisma.$transaction((tx) => transicionarParaPago(tx, orderId));
      revalidatePath("/admin/produtos");
      revalidatePath("/admin/pedidos");
    } catch (e) {
      console.error("[checkout] transicionar cartão aprovado", e);
    }
    return { resultado: "aprovado", numero };
  }

  if (pago.status === StatusPagamento.EM_ANALISE) {
    return { resultado: "analise", numero };
  }

  // RECUSADO (ou qualquer não-pago): pedido segue aguardando; tenta de novo.
  return { resultado: "recusado", mensagem: mensagemRecusa(pago.statusDetail) };
}
