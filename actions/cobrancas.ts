"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { cobrancaSchema } from "@/lib/validations/cobranca";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import { getPaymentProvider } from "@/lib/payments/registry";
import { assertPermissao } from "@/lib/permissoes-server";
import { auditar } from "@/lib/auditoria";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { situacaoDaCobranca } from "@/lib/queries/cobrancas";
import {
  ProviderPagamento,
  StatusPagamento,
  MetodoPagamento,
} from "@/lib/generated/prisma/enums";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import { mensagemRecusa } from "@/lib/payments/mercadopago";
import type { CartaoInput, CartaoDesfecho } from "@/actions/checkout";
import type { Prisma } from "@/lib/generated/prisma/client";
import { type ActionResult } from "@/lib/utils/action-result";

/**
 * Cobrança avulsa — escrita.
 *
 * A cobrança é um Order `tipo = COBRANCA` com UM item avulso (productId null),
 * sem frete e sem envio. O cliente recebe `/cobrar/<publicToken>` e, ao clicar
 * em pagar, vai para o Checkout Pro do Mercado Pago — que oferece Pix e cartão
 * na mesma tela. Quem confirma é o WEBHOOK (external_reference = orderId), igual
 * ao checkout da loja: nada aqui marca pagamento por conta própria.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const soDigitos = (s: string | null | undefined) =>
  (s ?? "").replace(/\D/g, "") || null;
const nullify = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
};

/** Token do link: 32 hex (128 bits). Não é adivinhável e cabe numa URL curta. */
function novoToken(): string {
  return randomBytes(16).toString("hex");
}

// ── Criar ────────────────────────────────────────────────────────────────────
export async function criarCobranca(formData: FormData): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");

  const parsed = cobrancaSchema.safeParse({
    clienteId: formData.get("clienteId"),
    clienteNome: formData.get("clienteNome"),
    clienteEmail: formData.get("clienteEmail"),
    clienteTelefone: formData.get("clienteTelefone"),
    clienteCpf: formData.get("clienteCpf"),
    clienteCep: formData.get("clienteCep"),
    descricao: formData.get("descricao"),
    valor: formData.get("valor"),
    validadeDias: formData.get("validadeDias"),
    maxParcelas: formData.get("maxParcelas"),
    observacoes: formData.get("observacoes"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const data = parsed.data;
  const valor = round2(data.valor);

  // Cliente: o escolhido na lista ou um novo criado na hora.
  let clienteId = nullify(data.clienteId);
  if (!clienteId) {
    const novo = await prisma.cliente.create({
      data: {
        nome: (data.clienteNome ?? "").trim(),
        email: nullify(data.clienteEmail),
        telefone: soDigitos(data.clienteTelefone),
        cpfCnpj: soDigitos(data.clienteCpf),
        cep: soDigitos(data.clienteCep),
      },
      select: { id: true },
    });
    clienteId = novo.id;
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return { success: false, error: "Cliente não encontrado." };

  // Cliente já cadastrado sem e-mail: o Checkout Pro até abre, mas o pagamento
  // sai com pagador anônimo e o antifraude do MP recusa todo cartão. Melhor
  // barrar aqui do que o cliente descobrir na tela de pagamento.
  if (!cliente.email) {
    return {
      success: false,
      error: `${cliente.nome} está sem e-mail no cadastro. Preencha o e-mail do cliente antes de cobrar — o Mercado Pago precisa dele para aprovar cartão.`,
    };
  }

  // CPF e CEP digitados agora completam o cadastro de quem ainda não tinha (o
  // antifraude do MP pesa muito esses campos). Nunca apagam o que já existe.
  const cpfDigitado = soDigitos(data.clienteCpf);
  const cepDigitado = soDigitos(data.clienteCep);
  const completar: { cpfCnpj?: string; cep?: string } = {};
  if (cpfDigitado && cpfDigitado !== cliente.cpfCnpj) {
    completar.cpfCnpj = cpfDigitado;
    cliente.cpfCnpj = cpfDigitado;
  }
  if (cepDigitado && cepDigitado !== cliente.cep) {
    completar.cep = cepDigitado;
    cliente.cep = cepDigitado;
  }
  if (Object.keys(completar).length) {
    await prisma.cliente
      .update({ where: { id: cliente.id }, data: completar })
      .catch(() => {});
  }

  // Snapshot do pagador (mesmo formato do pedido). Cobrança não tem entrega, mas
  // o campo é a fonte de nome/e-mail/telefone usada depois pelo gateway.
  const endereco: EnderecoEntrega = {
    nome: cliente.nome,
    cpfCnpj: cliente.cpfCnpj,
    telefone: cliente.telefone,
    email: cliente.email,
    cep: null,
    logradouro: null,
    numero: null,
    complemento: null,
    bairro: null,
    cidade: null,
    uf: null,
  };

  const expiraEm = new Date(
    Date.now() + data.validadeDias * 24 * 60 * 60 * 1000,
  );
  const token = novoToken();

  let novoId = "";
  try {
    const criada = await prisma.$transaction(async (tx) => {
      // Mesma numeração dos pedidos: a cobrança também é um documento da loja e
      // precisa de um número que o cliente possa citar no WhatsApp.
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
          tipo: "COBRANCA",
          status: "AGUARDANDO_PAGAMENTO",
          tipoEntrega: "RETIRADA", // cobrança não despacha nada
          clienteId: clienteId as string,
          enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
          observacoes: nullify(data.observacoes),
          subtotal: valor,
          frete: 0,
          desconto: 0,
          total: valor,
          publicToken: token,
          expiraEm,
          maxParcelas: data.maxParcelas,
          items: {
            create: {
              productId: null, // item avulso: a descrição é o "produto"
              nomeProduto: data.descricao,
              quantidade: 1,
              precoUnitario: valor,
            },
          },
        },
        select: { id: true, numero: true },
      });
    });
    novoId = criada.id;

    await auditar(membro, {
      acao: "cobranca.criar",
      entidade: "Order",
      entidadeId: criada.id,
      descricao: `Criou a cobrança ${criada.numero} de ${valor.toFixed(2)} para ${cliente.nome}`,
      depois: {
        descricao: data.descricao,
        valor,
        validadeDias: data.validadeDias,
        maxParcelas: data.maxParcelas,
      },
    });
  } catch (e) {
    console.error("[cobranca] criar", e);
    return { success: false, error: "Erro ao criar a cobrança." };
  }

  revalidatePath("/admin/cobrancas");
  redirect(`/admin/cobrancas/${novoId}`);
}

// ── Cancelar ─────────────────────────────────────────────────────────────────
export async function cancelarCobranca(id: string): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");

  const cob = await prisma.order.findFirst({
    where: { id, tipo: "COBRANCA" },
    select: { id: true, numero: true, status: true, expiraEm: true, total: true },
  });
  if (!cob) return { success: false, error: "Cobrança não encontrada." };

  const situacao = situacaoDaCobranca(cob);
  if (situacao === "PAGA") {
    // Cobrança paga não se cancela por aqui: o dinheiro já entrou. O caminho é o
    // estorno na tela do pedido, que devolve ao cliente e ajusta o caixa.
    return {
      success: false,
      error: "Cobrança já paga. Para devolver o dinheiro, use o estorno.",
    };
  }
  if (situacao === "CANCELADA") return { success: true, message: "Já cancelada." };

  await prisma.order.update({
    where: { id },
    data: { status: "CANCELADO" },
  });

  await auditar(membro, {
    acao: "cobranca.cancelar",
    entidade: "Order",
    entidadeId: id,
    descricao: `Cancelou a cobrança ${cob.numero} de ${Number(cob.total).toFixed(2)}`,
    antes: { status: cob.status },
    depois: { status: "CANCELADO" },
  });

  revalidatePath("/admin/cobrancas");
  revalidatePath(`/admin/cobrancas/${id}`);
  return { success: true, message: "Cobrança cancelada. O link parou de funcionar." };
}

// ── Reabrir (renova a validade) ──────────────────────────────────────────────
export async function reabrirCobranca(
  id: string,
  dias = 7,
): Promise<ActionResult> {
  const membro = await assertPermissao("pedidos.editar");

  const cob = await prisma.order.findFirst({
    where: { id, tipo: "COBRANCA" },
    select: { id: true, numero: true, status: true, expiraEm: true },
  });
  if (!cob) return { success: false, error: "Cobrança não encontrada." };
  if (situacaoDaCobranca(cob) === "PAGA") {
    return { success: false, error: "Esta cobrança já foi paga." };
  }

  const validade = Math.min(Math.max(Math.round(dias), 1), 90);
  const expiraEm = new Date(Date.now() + validade * 24 * 60 * 60 * 1000);
  await prisma.order.update({
    where: { id },
    data: { status: "AGUARDANDO_PAGAMENTO", expiraEm },
  });

  await auditar(membro, {
    acao: "cobranca.reabrir",
    entidade: "Order",
    entidadeId: id,
    descricao: `Reabriu a cobrança ${cob.numero} por mais ${validade} dia(s)`,
    antes: { status: cob.status, expiraEm: cob.expiraEm },
    depois: { status: "AGUARDANDO_PAGAMENTO", expiraEm },
  });

  revalidatePath("/admin/cobrancas");
  revalidatePath(`/admin/cobrancas/${id}`);
  return { success: true, message: "Cobrança reaberta." };
}

// ── Pagar (público, chamado da página do link) ───────────────────────────────
export type PagarCobrancaResult =
  | { ok: true; initPoint: string }
  | { ok: false; error: string };

/**
 * Cria a preference no Mercado Pago para esta cobrança e devolve o init_point.
 * Chamado pelo botão da página pública. Não confia em nada do cliente além do
 * token: valor, descrição e teto de parcelas vêm do banco. A preference NÃO é
 * reaproveitada — o MP dedupe por idempotência própria e um link antigo pode ter
 * expirado; criar de novo é barato e sempre válido.
 */
export async function pagarCobranca(
  token: string,
): Promise<PagarCobrancaResult> {
  // Trava simples de abuso: o link é público e criar preference custa chamada ao MP.
  const ip = clientIp(await headers());
  const limite = rateLimit(`cobranca:${ip}`, 10, 60_000);
  if (!limite.ok) {
    return {
      ok: false,
      error: `Muitas tentativas. Tente de novo em ${limite.retryAfter}s.`,
    };
  }

  const cob = await prisma.order.findFirst({
    where: { tipo: "COBRANCA", publicToken: token },
    select: {
      id: true,
      numero: true,
      status: true,
      total: true,
      expiraEm: true,
      maxParcelas: true,
      enderecoEntrega: true,
      items: { select: { nomeProduto: true }, take: 1 },
      // Cadastro atual do cliente: se a loja completar CPF/e-mail depois de gerar
      // o link, o pagamento já sai com o pagador completo — sem precisar refazer
      // a cobrança. O snapshot continua valendo como piso.
      cliente: {
        select: {
          nome: true,
          email: true,
          cpfCnpj: true,
          telefone: true,
          cep: true,
          logradouro: true,
          numero: true,
          cidade: true,
          uf: true,
        },
      },
    },
  });
  if (!cob) return { ok: false, error: "Cobrança não encontrada." };

  const situacao = situacaoDaCobranca(cob);
  if (situacao === "PAGA") return { ok: false, error: "Esta cobrança já foi paga." };
  if (situacao === "CANCELADA") return { ok: false, error: "Esta cobrança foi cancelada." };
  if (situacao === "EXPIRADA") {
    return { ok: false, error: "Este link de pagamento venceu. Peça um novo à loja." };
  }

  const end = cob.enderecoEntrega as unknown as EnderecoEntrega;
  // Dados do pagador: o mais completo entre cadastro e snapshot. Campo vazio no
  // MP é pior que campo ausente — quanto mais o antifraude recebe, mais cartão
  // legítimo passa (sem isso a recusa vem como cc_rejected_high_risk).
  const pagadorNome = cob.cliente?.nome || end.nome || "";
  const pagadorEmail = cob.cliente?.email || end.email || "";
  const pagadorCpf = cob.cliente?.cpfCnpj || end.cpfCnpj || null;
  const pagadorTel = cob.cliente?.telefone || end.telefone || null;
  const partes = pagadorNome.trim().split(/\s+/);
  const descricao = cob.items[0]?.nomeProduto ?? `Cobrança ${cob.numero}`;
  const valor = round2(Number(cob.total));

  try {
    const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
    const pref = await provider.criarPreferencia({
      orderId: cob.id, // external_reference — é por aqui que o webhook acha
      itens: [{ id: cob.id, title: descricao, quantity: 1, unitPrice: valor }],
      pagador: {
        nome: partes[0] || null,
        sobrenome: partes.slice(1).join(" ") || null,
        // O MP exige e-mail do pagador; sem ele o pagamento sai anônimo e o
        // antifraude recusa todo cartão.
        email: pagadorEmail,
        cpfCnpj: pagadorCpf,
        telefone: pagadorTel,
      },
      backUrls: {
        success: `${SITE_URL}/cobrar/${token}`,
        pending: `${SITE_URL}/cobrar/${token}`,
        failure: `${SITE_URL}/cobrar/${token}`,
      },
      // Cobrança não despacha nada, então não há endereço de entrega. O endereço
      // do CADASTRO vai como endereço do pagador: mais um sinal de que a pessoa
      // é real. Quando o cliente é novo e não tem endereço, sai omitido.
      payerAddress: cob.cliente?.cep
        ? {
            cep: cob.cliente.cep,
            logradouro: cob.cliente.logradouro,
            numero: cob.cliente.numero,
            cidade: cob.cliente.cidade,
            uf: cob.cliente.uf,
          }
        : null,
      installmentsLimit: cob.maxParcelas ?? undefined,
      expiraEm: cob.expiraEm,
    });
    if (!pref.initPoint) {
      return { ok: false, error: "Não foi possível abrir o pagamento agora." };
    }

    await prisma.order
      .update({
        where: { id: cob.id },
        data: { mpPreferenceId: pref.preferenceId },
      })
      .catch(() => {}); // rastro útil, mas não vale travar o pagamento

    return { ok: true, initPoint: pref.initPoint };
  } catch (e) {
    console.error("[cobranca] preference", e);
    return {
      ok: false,
      error: "Não foi possível abrir o pagamento agora. Tente novamente.",
    };
  }
}

/**
 * Cartão DIRETO no link de cobrança (Card Payment Brick), no lugar de mandar o
 * cliente ao Checkout Pro.
 *
 * Motivo: no Checkout Pro quem cria o pagamento é o MP, então não dá para enviar
 * Device ID nem pedir 3DS — e era exatamente por isso que o link recusava cartão
 * bom (`security:none` + cc_rejected_high_risk em toda tentativa). Aqui o
 * pagamento sai do NOSSO servidor com os mesmos sinais do checkout da loja:
 * fingerprint no header, pagador completo, histórico e 3DS.
 *
 * Valor, descrição e teto de parcelas vêm do banco — do navegador só vem o token
 * do cartão (o servidor nunca vê número/CVV).
 */
export async function pagarCobrancaCartao(
  token: string,
  cartao: CartaoInput,
): Promise<CartaoDesfecho> {
  const ip = clientIp(await headers());
  const limite = rateLimit(`cobranca-cartao:${ip}`, 8, 60_000);
  if (!limite.ok) {
    return {
      resultado: "erro",
      mensagem: `Muitas tentativas. Tente de novo em ${limite.retryAfter}s.`,
    };
  }

  if (!cartao?.token || !cartao?.paymentMethodId) {
    return { resultado: "erro", mensagem: "Dados do cartão incompletos." };
  }

  const cob = await prisma.order.findFirst({
    where: { tipo: "COBRANCA", publicToken: token },
    select: {
      id: true,
      numero: true,
      status: true,
      total: true,
      expiraEm: true,
      maxParcelas: true,
      enderecoEntrega: true,
      items: { select: { nomeProduto: true }, take: 1 },
      cliente: {
        select: {
          id: true,
          nome: true,
          email: true,
          cpfCnpj: true,
          telefone: true,
          cep: true,
          logradouro: true,
          numero: true,
          criadoEm: true,
        },
      },
    },
  });
  if (!cob) return { resultado: "erro", mensagem: "Cobrança não encontrada." };

  const situacao = situacaoDaCobranca(cob);
  if (situacao === "PAGA") {
    return { resultado: "erro", mensagem: "Esta cobrança já foi paga." };
  }
  if (situacao === "CANCELADA") {
    return { resultado: "erro", mensagem: "Esta cobrança foi cancelada." };
  }
  if (situacao === "EXPIRADA") {
    return {
      resultado: "erro",
      mensagem: "Este link de pagamento venceu. Peça um novo à loja.",
    };
  }

  // Parcelamento sai do banco (anti-tamper): o navegador não define o teto.
  const teto = cob.maxParcelas ?? 12;
  const parcelas = Number(cartao.installments);
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > teto) {
    return { resultado: "erro", mensagem: "Opção de parcelamento inválida." };
  }

  const end = cob.enderecoEntrega as unknown as EnderecoEntrega;
  const nome = cob.cliente?.nome || end.nome || "";
  const partes = nome.trim().split(/\s+/);
  const descricao = cob.items[0]?.nomeProduto ?? `Cobrança ${cob.numero}`;
  const valor = round2(Number(cob.total));
  const emailPagador =
    cartao.payer?.email || cob.cliente?.email || end.email || "";
  const cpfPagador =
    cartao.payer?.identification?.number || cob.cliente?.cpfCnpj || end.cpfCnpj;

  // Histórico do comprador (mesmos sinais do checkout da loja).
  const historico = await (async () => {
    if (!cob.cliente) return null;
    try {
      const anterior = await prisma.order.findFirst({
        where: {
          clienteId: cob.cliente.id,
          id: { not: cob.id },
          status: { in: ["PAGO", "ENVIADO", "ENTREGUE"] },
        },
        orderBy: { criadoEm: "desc" },
        select: { criadoEm: true },
      });
      return {
        cadastradoEm: cob.cliente.criadoEm,
        ultimaCompraEm: anterior?.criadoEm ?? null,
        primeiraCompra: !anterior,
      };
    } catch {
      return null;
    }
  })();

  let pago;
  try {
    const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
    pago = await provider.criarPagamentoCartao({
      orderId: cob.id, // external_reference — o webhook acha por aqui
      valor,
      descricao: `${cob.numero} — Guppy de Linhagem`,
      token: cartao.token,
      paymentMethodId: cartao.paymentMethodId,
      issuerId: cartao.issuerId,
      installments: parcelas,
      deviceId: cartao.deviceId ?? null,
      pagador: {
        email: emailPagador,
        cpfCnpj: cpfPagador,
        nome: partes[0] || null,
        sobrenome: partes.slice(1).join(" ") || null,
        telefone: cob.cliente?.telefone || end.telefone,
      },
      // Cobrança não despacha nada: sem shipments; o endereço do cadastro vai
      // como endereço do pagador.
      endereco: null,
      payerAddress: cob.cliente?.cep
        ? {
            cep: cob.cliente.cep,
            logradouro: cob.cliente.logradouro,
            numero: cob.cliente.numero,
          }
        : null,
      itens: [
        {
          id: cob.id,
          title: descricao,
          quantity: 1,
          unitPrice: valor,
        },
      ],
      historico,
    });
  } catch (e) {
    console.error("[cobranca] cartão", e);
    return {
      resultado: "erro",
      mensagem:
        e instanceof Error ? e.message : "Não foi possível processar o cartão.",
    };
  }

  // Grava a tentativa (aprovada ou não) — mesma trilha do checkout.
  try {
    await prisma.pagamento.create({
      data: {
        orderId: cob.id,
        provider: ProviderPagamento.MERCADO_PAGO,
        metodo: MetodoPagamento.CARTAO,
        status: pago.status,
        valor,
        externalId: pago.externalId,
        parcelas: pago.parcelas,
        bandeira: pago.bandeira,
        payloadRaw: {
          statusDetail: pago.statusDetail,
          deviceId: cartao.deviceId ? "ok" : "vazio",
        } as Prisma.InputJsonValue,
      },
    });
    await prisma.order.update({
      where: { id: cob.id },
      data: { mpPaymentId: pago.externalId, parcelas: pago.parcelas },
    });
  } catch (e) {
    console.error("[cobranca] gravar Pagamento cartão", e);
  }

  // 3DS: o banco quer autenticar antes de decidir.
  if (pago.threeDs) {
    return {
      resultado: "desafio",
      numero: cob.numero,
      paymentId: pago.externalId,
      externalResourceUrl: pago.threeDs.externalResourceUrl,
      creq: pago.threeDs.creq,
    };
  }

  if (pago.status === StatusPagamento.PAGO) {
    try {
      await prisma.$transaction((tx) => transicionarParaPago(tx, cob.id));
      revalidatePath("/admin/cobrancas");
    } catch (e) {
      console.error("[cobranca] transicionar cartão aprovado", e);
    }
    return { resultado: "aprovado", numero: cob.numero };
  }

  if (pago.status === StatusPagamento.EM_ANALISE) {
    return { resultado: "analise", numero: cob.numero };
  }

  return { resultado: "recusado", mensagem: mensagemRecusa(pago.statusDetail) };
}

/**
 * Status da cobrança lido do BANCO (o webhook é quem confirma). Público e leve —
 * usado pelo poll da página do link, quando o cliente volta do gateway antes da
 * notificação chegar. Não chama o gateway.
 */
export async function statusDaCobranca(token: string): Promise<boolean> {
  const cob = await prisma.order.findFirst({
    where: { tipo: "COBRANCA", publicToken: token },
    select: { status: true },
  });
  return (
    cob?.status === "PAGO" ||
    cob?.status === "ENVIADO" ||
    cob?.status === "ENTREGUE"
  );
}
