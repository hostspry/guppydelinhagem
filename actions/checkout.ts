"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkoutSchema,
  type CheckoutInput,
  type CheckoutFormInput,
} from "@/lib/validations/checkout";
import { calcularPesoECaixa, cotarFrete } from "@/lib/shipping";
import { getPaymentProvider } from "@/lib/payments/registry";
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

/**
 * Cria o pedido no checkout público (guest) e gera a cobrança Pix.
 *
 * Anti-fraude: o PREÇO de cada item e o FRETE são recalculados NO SERVIDOR a
 * partir do banco e da cotadora — nunca confia no que o client mandou. Cria/reusa
 * Cliente, cria Order AGUARDANDO_PAGAMENTO (sem baixar estoque — só no PAGO) e a
 * linha Pagamento PENDENTE com o QR. Devolve o QR/copia-e-cola pra tela do Pix.
 */
export async function criarPedidoCheckout(
  input: CheckoutFormInput,
): Promise<CheckoutResult> {
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

  // ── 4. Gerar a cobrança Pix no MP + gravar Pagamento (fora da transação) ───
  const partesNome = data.nome.trim().split(/\s+/);
  try {
    const pixData = await emitirPix({
      orderId,
      numero,
      valor: total,
      pagador: {
        nome: partesNome[0],
        sobrenome: partesNome.slice(1).join(" ") || null,
        email: data.email,
        cpfCnpj: cpf,
      },
    });
    return { ok: true, data: pixData };
  } catch (e) {
    console.error("[checkout] criar Pix", e);
    // Sem pagamento não há pedido útil → remove o rascunho pra não poluir o admin.
    await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
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
