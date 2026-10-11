"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { calcularPesoECaixa, cotarFrete, type FreteEndereco } from "@/lib/shipping";
import { freteGollog, LOJA_ENDERECO } from "@/lib/constants";
import { getConfiguracaoLoja } from "@/lib/queries/config";
import { getPaymentProvider } from "@/lib/payments/registry";
import { mensagemRecusa } from "@/lib/payments/mercadopago";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import { notificarPedidoPago } from "@/lib/notificacoes";
import { registrarFalhaCartao } from "@/lib/pagamento-tentativas";
import { situacaoDoArremate, type SituacaoArremate } from "@/lib/leiloes/situacao";
import {
  entregaArremateSchema,
  type EntregaArremateForm,
} from "@/lib/validations/leilao";
import type { EnderecoEntrega } from "@/lib/validations/pedido";
import type { PixArremate } from "@/lib/queries/leiloes";
import type { CartaoInput, CartaoDesfecho } from "@/actions/checkout";
import {
  MetodoPagamento,
  ProviderPagamento,
  StatusPagamento,
  Transportadora,
} from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Pagamento do arremate — público (link com token) e área do cliente.
 *
 * Duas etapas, e o servidor decide tudo que é dinheiro:
 *  1. Entrega: o cliente informa endereço e escolhe terrestre, aéreo ou
 *     retirada. O frete é RE-COTADO aqui (nunca vem do navegador) e gravado no
 *     pedido junto com o total.
 *  2. Pagamento: Pix ou cartão sobre o total gravado. Quem confirma o Pix é o
 *     webhook (external_reference = orderId), igual ao checkout da loja.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

async function travar(acao: string, limite: number): Promise<string | null> {
  const ip = clientIp(await headers());
  const r = rateLimit(`leilao-${acao}:${ip}`, limite, 60_000);
  return r.ok ? null : `Muitas tentativas seguidas. Espere ${r.retryAfter}s e tente de novo.`;
}

async function carregar(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token ?? "")) return null;
  return prisma.order.findFirst({
    where: { origem: "LEILAO", publicToken: token },
    select: {
      id: true,
      numero: true,
      status: true,
      subtotal: true,
      frete: true,
      total: true,
      expiraEm: true,
      maxParcelas: true,
      entregaEscolhidaEm: true,
      tipoEntrega: true,
      enderecoEntrega: true,
      leilaoId: true,
      items: { orderBy: { id: "asc" }, select: { id: true, nomeProduto: true, precoUnitario: true } },
      lotesLeilao: { select: { qtdPeixes: true } },
      pagamentos: { select: { status: true } },
      cliente: {
        select: { id: true, nome: true, email: true, cpfCnpj: true, telefone: true, criadoEm: true },
      },
    },
  });
}
type Arremate = NonNullable<Awaited<ReturnType<typeof carregar>>>;

function bloqueio(s: SituacaoArremate): string | null {
  if (s === "PAGA") return "Esta cobrança já foi paga.";
  if (s === "CANCELADA") return "Esta cobrança foi cancelada. Fale com a loja no WhatsApp.";
  if (s === "VENCIDA") return "O prazo para pagar venceu. Fale com a loja no WhatsApp para renovar.";
  return null;
}

const qtdPeixes = (o: Arremate) =>
  Math.max(1, o.lotesLeilao.reduce((a, l) => a + l.qtdPeixes, 0));

function revalidar(o: Arremate) {
  if (o.leilaoId) revalidatePath(`/admin/leiloes/${o.leilaoId}`);
  revalidatePath("/minha-conta/leiloes");
}

// ── 1. Cotação ───────────────────────────────────────────────────────────────

export type OpcaoEntrega =
  | { disponivel: true; preco: number; prazo: string }
  | { disponivel: false; motivo: string };

export type CotacaoArremate =
  | {
      ok: true;
      endereco: FreteEndereco | null;
      terrestre: OpcaoEntrega;
      aereo: OpcaoEntrega;
      /** Peixes demais para uma caixa: o frete é combinado no WhatsApp. */
      acimaDoLimite: boolean;
    }
  | { ok: false; error: string };

/** Mesma conta do checkout: Jadlog cotada no Melhor Envio, Gollog por UF. */
async function cotarOpcoes(cep: string, peixes: number, ufInformada?: string) {
  const { pesoGramas, caixa } = calcularPesoECaixa(peixes);
  const cot = await cotarFrete({ cepDestino: cep, pesoGramas, caixa, qtdPeixes: peixes });
  if (!cot.ok) return cot;

  const jad = cot.data.jadlog.find((j) => j.id === 4) ?? cot.data.jadlog[0];
  const terrestre: OpcaoEntrega = !jad
    ? { disponivel: false, motivo: "Sem frete terrestre automático para esse CEP." }
    : jad.requerAvaliacao
      ? {
          disponivel: false,
          motivo: `O terrestre leva ${jad.deliveryTime} dias úteis, tempo demais para peixe vivo. Use o aéreo ou combine pelo WhatsApp.`,
        }
      : { disponivel: true, preco: round2(jad.price), prazo: `${jad.deliveryTime} dias úteis` };

  const uf = cot.data.endereco?.uf || ufInformada || "";

  // Regra do leilão: não enviamos para Belém-PA (nem terrestre nem aéreo).
  const cidade = (cot.data.endereco?.cidade ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (cidade === "belem" && uf.toUpperCase() === "PA") {
    const motivo = "Não enviamos para Belém-PA. Me chame no WhatsApp para combinarmos.";
    return {
      ok: true as const,
      endereco: cot.data.endereco,
      terrestre: { disponivel: false, motivo } as OpcaoEntrega,
      aereo: { disponivel: false, motivo } as OpcaoEntrega,
    };
  }

  const g = freteGollog(uf);
  const aereo: OpcaoEntrega = g
    ? { disponivel: true, preco: round2(g.preco), prazo: "1 a 2 dias úteis, retirada no aeroporto" }
    : { disponivel: false, motivo: "Aéreo indisponível para essa região. Combine pelo WhatsApp." };

  return { ok: true as const, endereco: cot.data.endereco, terrestre, aereo };
}

export async function cotarEntregaArremate(
  token: string,
  cep: string,
): Promise<CotacaoArremate> {
  const trava = await travar("frete", 15);
  if (trava) return { ok: false, error: trava };

  const o = await carregar(token);
  if (!o) return { ok: false, error: "Cobrança não encontrada." };
  const b = bloqueio(situacaoDoArremate(o));
  if (b) return { ok: false, error: b };

  const peixes = qtdPeixes(o);
  const { maxPeixesFreteAuto } = await getConfiguracaoLoja();
  const r = await cotarOpcoes(String(cep ?? ""), peixes);
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    endereco: r.endereco,
    terrestre: r.terrestre,
    aereo: r.aereo,
    acimaDoLimite: peixes > maxPeixesFreteAuto,
  };
}

// ── 2. Entrega escolhida ─────────────────────────────────────────────────────

export type SalvarEntregaResult =
  | { ok: true; frete: number; total: number }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function salvarEntregaArremate(
  token: string,
  input: EntregaArremateForm,
): Promise<SalvarEntregaResult> {
  const trava = await travar("entrega", 15);
  if (trava) return { ok: false, error: trava };

  const parsed = entregaArremateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira os dados destacados.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const o = await carregar(token);
  if (!o) return { ok: false, error: "Cobrança não encontrada." };
  const b = bloqueio(situacaoDoArremate(o));
  if (b) return { ok: false, error: b };
  if (o.pagamentos.some((p) => p.status === "EM_ANALISE")) {
    return {
      ok: false,
      error: "Seu pagamento no cartão está em análise. Aguarde a resposta antes de mudar a entrega.",
    };
  }

  const retirada = d.tipoEntrega === "RETIRADA";
  let frete = 0;
  let transportadora: Transportadora | null = null;
  let modalidade: "TERRESTRE" | "AEREO" | null = null;

  if (retirada) {
    const { retiradaLocalAtiva } = await getConfiguracaoLoja();
    if (!retiradaLocalAtiva) {
      return { ok: false, error: "A retirada na loja não está disponível agora. Escolha o envio." };
    }
  } else {
    const peixes = qtdPeixes(o);
    const { maxPeixesFreteAuto } = await getConfiguracaoLoja();
    if (peixes > maxPeixesFreteAuto) {
      return {
        ok: false,
        error: `Com mais de ${maxPeixesFreteAuto} peixes o frete é combinado. Chame a loja no WhatsApp.`,
      };
    }
    // Anti-tamper: o preço sai de uma cotação feita agora, para este CEP.
    const r = await cotarOpcoes(d.cep, peixes, d.uf);
    if (!r.ok) return { ok: false, error: r.error };
    const opcao = d.modalidadeFrete === "AEREO" ? r.aereo : r.terrestre;
    if (!opcao.disponivel) return { ok: false, error: opcao.motivo };
    frete = opcao.preco;
    modalidade = d.modalidadeFrete;
    transportadora = modalidade === "AEREO" ? Transportadora.GOLLOG : Transportadora.JADLOG;
  }

  const endereco: EnderecoEntrega = {
    nome: d.nome,
    cpfCnpj: d.cpfCnpj,
    telefone: d.telefone,
    email: d.email,
    cep: retirada ? null : d.cep,
    logradouro: retirada ? null : d.logradouro,
    numero: retirada ? null : d.numero,
    complemento: retirada ? null : d.complemento || null,
    bairro: retirada ? null : d.bairro,
    cidade: retirada ? null : d.cidade,
    uf: retirada ? null : d.uf.toUpperCase(),
  };
  const total = round2(Number(o.subtotal) + frete);

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: o.id },
      data: {
        enderecoEntrega: endereco as unknown as Prisma.InputJsonValue,
        tipoEntrega: retirada ? "RETIRADA" : "ENVIO",
        transportadora,
        modalidadeFrete: modalidade,
        servicoEnvioId: null,
        servicoEnvioNome: null,
        frete,
        total,
        entregaEscolhidaEm: new Date(),
      },
    });
    // Pix emitido com outro valor não fecha mais a conta desta cobrança.
    await tx.pagamento.updateMany({
      where: { orderId: o.id, metodo: "PIX", status: "PENDENTE", valor: { not: total } },
      data: { status: "EXPIRADO" },
    });
  });

  // O cadastro ganha o que o próprio cliente digitou (antifraude e próximas
  // compras). Na retirada o endereço salvo fica como estava.
  await prisma.cliente
    .update({
      where: { id: o.cliente.id },
      data: {
        nome: d.nome,
        email: d.email,
        cpfCnpj: d.cpfCnpj,
        telefone: d.telefone,
        ...(retirada
          ? {}
          : {
              cep: d.cep,
              logradouro: d.logradouro,
              numero: d.numero,
              complemento: d.complemento || null,
              bairro: d.bairro,
              cidade: d.cidade,
              uf: d.uf.toUpperCase(),
            }),
      },
    })
    .catch((e) => console.error("[leilao] atualizar cadastro", e));

  revalidar(o);
  return { ok: true, frete, total };
}

// ── 3a. Pix ──────────────────────────────────────────────────────────────────

export type PixArremateResult =
  | { ok: true; pix: PixArremate }
  | { ok: false; error: string };

function prontoParaPagar(o: Arremate): string | null {
  const b = bloqueio(situacaoDoArremate(o));
  if (b) return b;
  if (!o.entregaEscolhidaEm) return "Escolha a entrega antes de pagar.";
  return null;
}

export async function pagarArrematePix(token: string): Promise<PixArremateResult> {
  const trava = await travar("pix", 8);
  if (trava) return { ok: false, error: trava };

  const o = await carregar(token);
  if (!o) return { ok: false, error: "Cobrança não encontrada." };
  const erro = prontoParaPagar(o);
  if (erro) return { ok: false, error: erro };

  const end = (o.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>;
  const email = end.email || o.cliente.email;
  if (!email) return { ok: false, error: "Informe seu e-mail na entrega para gerar o Pix." };
  const partes = (end.nome || o.cliente.nome).trim().split(/\s+/);
  const valor = round2(Number(o.total));

  try {
    const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
    const pix = await provider.criarPagamentoPix({
      orderId: o.id, // external_reference — o webhook acha o pedido por aqui
      valor,
      descricao: `Pedido ${o.numero} — Guppy de Linhagem`,
      pagador: {
        nome: partes[0] || null,
        sobrenome: partes.slice(1).join(" ") || null,
        email,
        cpfCnpj: end.cpfCnpj || o.cliente.cpfCnpj,
      },
    });
    const expiraEm = pix.expiraEm ? pix.expiraEm.toISOString() : null;
    try {
      await prisma.pagamento.create({
        data: {
          orderId: o.id,
          provider: ProviderPagamento.MERCADO_PAGO,
          metodo: MetodoPagamento.PIX,
          status: pix.status === StatusPagamento.PAGO ? StatusPagamento.PAGO : StatusPagamento.PENDENTE,
          valor,
          externalId: pix.externalId,
          qrCode: pix.qrCode,
          linkPagamento: pix.ticketUrl,
          payloadRaw: {
            qrCodeBase64: pix.qrCodeBase64,
            ticketUrl: pix.ticketUrl,
            expiraEm,
          } as Prisma.InputJsonValue,
        },
      });
      await prisma.order.update({
        where: { id: o.id },
        data: { mpPaymentId: pix.externalId, formaPagamento: "PIX" },
      });
    } catch (e) {
      // O Pix já existe no MP: não dá para esconder o QR do cliente por isso.
      console.error("[leilao] gravar Pagamento Pix", e);
    }
    revalidar(o);
    return {
      ok: true,
      pix: {
        valor,
        qrCodeBase64: pix.qrCodeBase64,
        copiaECola: pix.copiaECola ?? pix.qrCode,
        ticketUrl: pix.ticketUrl,
        expiraEm,
      },
    };
  } catch (e) {
    console.error("[leilao] criar Pix", e);
    return { ok: false, error: "Não foi possível gerar o Pix agora. Tente de novo em instantes." };
  }
}

// ── 3b. Cartão ───────────────────────────────────────────────────────────────

/**
 * Cartão pelo Card Payment Brick, cobrado do NOSSO servidor (Device ID no
 * header, pagador completo, endereço de entrega e histórico — os mesmos sinais
 * do checkout da loja). Do navegador só vem o token do cartão.
 */
export async function pagarArremateCartao(
  token: string,
  cartao: CartaoInput,
): Promise<CartaoDesfecho> {
  const barrado = async (motivo: string, mensagem: string, o?: Arremate) => {
    await registrarFalhaCartao({
      etapa: "VALIDACAO",
      provider: ProviderPagamento.MERCADO_PAGO,
      mensagem: `${motivo}: ${mensagem}`,
      parcelas: Number(cartao?.installments) || null,
      deviceOk: !!cartao?.deviceId,
      orderId: o?.id ?? null,
      numero: o?.numero ?? null,
      email: o?.cliente.email ?? null,
      telefone: o?.cliente.telefone ?? null,
      valor: o ? round2(Number(o.total)) : null,
      fluxo: "leilao",
    });
    return { resultado: "erro" as const, mensagem };
  };

  const trava = await travar("cartao", 6);
  if (trava) return barrado("limite de tentativas", trava);
  if (!cartao?.token || !cartao?.paymentMethodId) {
    return barrado("token ou bandeira vazios", "Dados do cartão incompletos.");
  }

  const o = await carregar(token);
  if (!o) return barrado("link sem cobrança", "Cobrança não encontrada.");
  const erro = prontoParaPagar(o);
  if (erro) return barrado("cobrança fora do prazo ou sem entrega", erro, o);

  const teto = o.maxParcelas ?? 12;
  const parcelas = Number(cartao.installments);
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > teto) {
    return barrado(`parcelas ${cartao.installments} fora do teto ${teto}`, "Opção de parcelamento inválida.", o);
  }

  const end = (o.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>;
  const retirada = o.tipoEntrega === "RETIRADA";
  const nome = end.nome || o.cliente.nome;
  const partes = nome.trim().split(/\s+/);
  const valor = round2(Number(o.total));
  const emailPagador = cartao.payer?.email || end.email || o.cliente.email || "";
  const cpfPagador = cartao.payer?.identification?.number || end.cpfCnpj || o.cliente.cpfCnpj;
  const telefone = end.telefone || o.cliente.telefone || null;
  const enderecoCliente = {
    cep: end.cep ?? null,
    uf: end.uf ?? null,
    cidade: end.cidade ?? null,
    logradouro: end.logradouro ?? null,
    numero: end.numero ?? null,
  };

  const historico = await (async () => {
    try {
      const anterior = await prisma.order.findFirst({
        where: {
          clienteId: o.cliente.id,
          id: { not: o.id },
          status: { in: ["PAGO", "ENVIADO", "ENTREGUE"] },
        },
        orderBy: { criadoEm: "desc" },
        select: { criadoEm: true },
      });
      return {
        cadastradoEm: o.cliente.criadoEm,
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
      orderId: o.id,
      valor,
      descricao: `Pedido ${o.numero} — Guppy de Linhagem`,
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
        telefone,
      },
      endereco: retirada ? LOJA_ENDERECO : enderecoCliente,
      payerAddress: retirada ? null : enderecoCliente,
      envio: { localPickup: retirada },
      itens: o.items.map((i) => ({
        id: i.id,
        title: i.nomeProduto,
        quantity: 1,
        unitPrice: round2(Number(i.precoUnitario)),
      })),
      historico,
    });
  } catch (e) {
    console.error("[leilao] cartão", e);
    await registrarFalhaCartao({
      etapa: "COBRANCA",
      provider: ProviderPagamento.MERCADO_PAGO,
      mensagem: e instanceof Error ? e.message : String(e),
      valor,
      parcelas,
      deviceOk: !!cartao.deviceId,
      orderId: o.id,
      numero: o.numero,
      email: emailPagador || null,
      telefone,
      fluxo: "leilao",
    });
    return {
      resultado: "erro",
      mensagem: e instanceof Error ? e.message : "Não foi possível processar o cartão.",
    };
  }

  try {
    await prisma.pagamento.create({
      data: {
        orderId: o.id,
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
      where: { id: o.id },
      data: { mpPaymentId: pago.externalId, parcelas: pago.parcelas, formaPagamento: "CARTAO" },
    });
  } catch (e) {
    console.error("[leilao] gravar Pagamento cartão", e);
  }

  if (pago.threeDs) {
    return {
      resultado: "desafio",
      numero: o.numero,
      paymentId: pago.externalId,
      externalResourceUrl: pago.threeDs.externalResourceUrl,
      creq: pago.threeDs.creq,
    };
  }

  if (pago.status === StatusPagamento.PAGO) {
    let baixou = false;
    try {
      const res = await prisma.$transaction((tx) => transicionarParaPago(tx, o.id));
      baixou = res.baixou;
    } catch (e) {
      console.error("[leilao] transicionar cartão aprovado", e);
    }
    if (baixou) {
      await notificarPedidoPago(o.id, {
        provider: ProviderPagamento.MERCADO_PAGO,
        metodo: MetodoPagamento.CARTAO,
      });
    }
    revalidar(o);
    revalidatePath("/admin/pedidos");
    return { resultado: "aprovado", numero: o.numero };
  }

  if (pago.status === StatusPagamento.EM_ANALISE) {
    revalidar(o);
    return { resultado: "analise", numero: o.numero };
  }

  await registrarFalhaCartao({
    etapa: "RECUSA",
    provider: ProviderPagamento.MERCADO_PAGO,
    mensagem: mensagemRecusa(pago.statusDetail),
    statusDetail: pago.statusDetail,
    valor,
    parcelas: pago.parcelas,
    deviceOk: !!cartao.deviceId,
    orderId: o.id,
    numero: o.numero,
    email: emailPagador || null,
    telefone,
    fluxo: "leilao",
    pagamentoExternoId: pago.externalId,
  });
  return { resultado: "recusado", mensagem: mensagemRecusa(pago.statusDetail) };
}

// ── Status (poll da página) ──────────────────────────────────────────────────

/** Lido do BANCO (o webhook confirma). Leve: não chama o gateway. */
export async function arrematePago(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(token ?? "")) return false;
  const o = await prisma.order.findFirst({
    where: { origem: "LEILAO", publicToken: token },
    select: { status: true },
  });
  return o?.status === "PAGO" || o?.status === "ENVIADO" || o?.status === "ENTREGUE";
}
