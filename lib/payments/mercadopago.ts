import "server-only";
import { randomUUID } from "node:crypto";
import {
  ProviderPagamento,
  StatusPagamento,
  MetodoPagamento,
} from "@/lib/generated/prisma/enums";
import type {
  PaymentProvider,
  CriarPixInput,
  PixCriado,
  PixConsulta,
  CriarCartaoInput,
  CartaoCriado,
  EstornoCriado,
  CriarPreferenciaInput,
  PreferenciaCriada,
} from "./provider";

// Provider Mercado Pago — Pix via Checkout Transparente (API clássica de
// pagamentos: POST /v1/payments). Token TEST- (modo teste) ou produção vem de
// process.env.MP_ACCESS_TOKEN — SERVER ONLY, nunca exposto ao client (o
// `server-only` quebra o build se alguém importar daqui de um Client Component).
//
// Doc MP: criar pagamento Pix em /v1/payments com payment_method_id "pix"; o QR
// volta em point_of_interaction.transaction_data.{qr_code, qr_code_base64,
// ticket_url}. Ref: developers.mercadopago.com — Checkout API / Pix.

const MP_API = "https://api.mercadopago.com";

// URL de notificação registrada no painel do MP (produção). O webhook valida a
// assinatura; em modo teste o MP envia "Simular notificação" para cá.
const NOTIFICATION_URL =
  "https://www.guppydelinhagem.com.br/api/webhooks/mercadopago";

// Janela de validade do Pix. Spec: 30–60 min.
const PIX_EXPIRACAO_MIN = 30;

function accessToken(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) {
    throw new Error(
      "MP_ACCESS_TOKEN não configurado. Pagamento indisponível no momento.",
    );
  }
  return t;
}

// MP status → StatusPagamento (nosso enum). Serve Pix e Cartão (e o webhook).
// `in_process` (cartão em análise) → EM_ANALISE — NÃO baixa estoque ainda; o Pix
// nunca cai em in_process (pending → approved). status_detail distingue Pix
// expirado (cancelled + "expired") de cancelamento/recusa comum.
function mapStatus(
  mpStatus: string | undefined,
  statusDetail: string | undefined,
): StatusPagamento {
  switch (mpStatus) {
    case "approved":
      return StatusPagamento.PAGO;
    case "in_process":
      return StatusPagamento.EM_ANALISE;
    case "pending":
    case "authorized":
      return StatusPagamento.PENDENTE;
    case "refunded":
    case "charged_back":
      return StatusPagamento.ESTORNADO;
    case "cancelled":
      return statusDetail === "expired"
        ? StatusPagamento.EXPIRADO
        : StatusPagamento.RECUSADO;
    case "rejected":
      return StatusPagamento.RECUSADO;
    default:
      return StatusPagamento.PENDENTE;
  }
}

// status_detail de recusa (MP) → frase PT amigável. Usado quando RECUSADO.
export function mensagemRecusa(detalhe: string | null | undefined): string {
  switch (detalhe) {
    case "cc_rejected_insufficient_amount":
      return "Saldo ou limite insuficiente.";
    case "cc_rejected_bad_filled_security_code":
      return "Código de segurança (CVV) incorreto.";
    case "cc_rejected_bad_filled_date":
      return "Data de validade incorreta.";
    case "cc_rejected_bad_filled_card_number":
      return "Número do cartão incorreto.";
    case "cc_rejected_bad_filled_other":
      return "Dados do cartão incorretos. Confira e tente de novo.";
    case "cc_rejected_high_risk":
      return "Pagamento não autorizado pelo emissor.";
    case "cc_rejected_call_for_authorize":
      return "Autorize o pagamento com o emissor do seu cartão e tente de novo.";
    case "cc_rejected_card_disabled":
      return "Cartão desabilitado. Ative-o com o emissor ou use outro.";
    case "cc_rejected_duplicated_payment":
      return "Pagamento duplicado. Aguarde alguns minutos antes de tentar de novo.";
    case "cc_rejected_max_attempts":
      return "Muitas tentativas. Tente mais tarde ou use outro cartão.";
    case "cc_rejected_blacklist":
      return "Pagamento não autorizado. Use outro cartão.";
    default:
      return "Pagamento recusado. Tente outro cartão.";
  }
}

// MP espera date_of_expiration em ISO 8601 com offset explícito. O Brasil não tem
// mais horário de verão (offset fixo -03:00), então formatamos o instante com
// -03:00 deslocando os componentes e rotulando o fuso (mesmo instante absoluto).
function isoComOffsetBrasil(d: Date): string {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}` +
    `.${p(local.getUTCMilliseconds(), 3)}-03:00`
  );
}

// Telefone BR (só dígitos) → { area_code, number } que o MP espera no payer/phone.
// DDD = 2 primeiros dígitos; o resto é o número. <10 dígitos → não envia (incompleto).
function telefoneMp(
  tel: string | null | undefined,
): { area_code: string; number: string } | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return { area_code: d.slice(0, 2), number: d.slice(2) };
}

// payment_type_id do MP → nosso MetodoPagamento (p/ o webhook criar a linha
// Pagamento do Checkout Pro, onde o método só é conhecido após o cliente pagar).
function metodoDoTipoPagamento(tipo: string | undefined): MetodoPagamento {
  switch (tipo) {
    case "credit_card":
    case "debit_card":
    case "prepaid_card":
      return MetodoPagamento.CARTAO;
    case "bank_transfer":
    case "pix":
      return MetodoPagamento.PIX;
    case "ticket":
    case "atm":
      return MetodoPagamento.BOLETO;
    case "account_money":
    default:
      return MetodoPagamento.CARTEIRA;
  }
}

async function mpFetch(
  path: string,
  init: RequestInit & { idempotencyKey?: string },
): Promise<unknown> {
  const { idempotencyKey, ...rest } = init;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken()}`,
    ...(rest.headers as Record<string, string> | undefined),
  };
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

  let resp: Response;
  try {
    resp = await fetch(`${MP_API}${path}`, { ...rest, headers, cache: "no-store" });
  } catch {
    throw new Error("Não foi possível falar com o Mercado Pago agora.");
  }

  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!resp.ok) {
    const msg =
      (data as { message?: string } | null)?.message ??
      `Mercado Pago respondeu ${resp.status}.`;
    // Log server-side com detalhe; mensagem limpa pro chamador.
    console.error("[mercadopago]", path, resp.status, text);
    throw new Error(msg);
  }
  return data;
}

type MpPaymentResponse = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  installments?: number;
  payment_method_id?: string;
  payment_type_id?: string;
  transaction_amount?: number;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

export const mercadoPagoProvider: PaymentProvider = {
  nome: ProviderPagamento.MERCADO_PAGO,

  async criarPagamentoPix(input: CriarPixInput): Promise<PixCriado> {
    const expiraEm = new Date(Date.now() + PIX_EXPIRACAO_MIN * 60 * 1000);

    const cpfCnpj = input.pagador.cpfCnpj?.replace(/\D/g, "") || null;
    const body = {
      transaction_amount: Math.round(input.valor * 100) / 100,
      description: input.descricao,
      payment_method_id: "pix",
      external_reference: input.orderId,
      notification_url: NOTIFICATION_URL,
      date_of_expiration: isoComOffsetBrasil(expiraEm),
      payer: {
        email: input.pagador.email,
        ...(input.pagador.nome ? { first_name: input.pagador.nome } : {}),
        ...(input.pagador.sobrenome
          ? { last_name: input.pagador.sobrenome }
          : {}),
        ...(cpfCnpj
          ? {
              identification: {
                type: cpfCnpj.length > 11 ? "CNPJ" : "CPF",
                number: cpfCnpj,
              },
            }
          : {}),
      },
    };

    const data = (await mpFetch("/v1/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    })) as MpPaymentResponse;

    const td = data.point_of_interaction?.transaction_data ?? {};
    return {
      externalId: String(data.id),
      status: mapStatus(data.status, data.status_detail),
      qrCode: td.qr_code ?? null,
      qrCodeBase64: td.qr_code_base64 ?? null,
      copiaECola: td.qr_code ?? null,
      ticketUrl: td.ticket_url ?? null,
      expiraEm: data.date_of_expiration
        ? new Date(data.date_of_expiration)
        : expiraEm,
    };
  },

  async criarPagamentoCartao(input: CriarCartaoInput): Promise<CartaoCriado> {
    const cpfCnpj = input.pagador.cpfCnpj?.replace(/\D/g, "") || null;
    const identification = cpfCnpj
      ? { type: cpfCnpj.length > 11 ? "CNPJ" : "CPF", number: cpfCnpj }
      : undefined;
    const phone = telefoneMp(input.pagador.telefone);
    const cep = input.endereco?.cep?.replace(/\D/g, "") || null; // shipments
    const payerCep = input.payerAddress?.cep?.replace(/\D/g, "") || null;

    // additional_info: sinais que o antifraude do MP usa pra aprovar pagamentos
    // legítimos (payer completo + items + endereço de entrega). Só inclui o que
    // existe — campo vazio é pior que ausente pro scoring. Na retirada o payer não
    // tem endereço (payerAddress null) → address é omitido; o shipments usa a loja.
    const additionalInfo = {
      ...(input.pagador.nome || input.pagador.sobrenome || phone || payerCep
        ? {
            payer: {
              ...(input.pagador.nome ? { first_name: input.pagador.nome } : {}),
              ...(input.pagador.sobrenome
                ? { last_name: input.pagador.sobrenome }
                : {}),
              ...(phone ? { phone } : {}),
              ...(payerCep ||
              input.payerAddress?.logradouro ||
              input.payerAddress?.numero
                ? {
                    address: {
                      ...(payerCep ? { zip_code: payerCep } : {}),
                      ...(input.payerAddress?.logradouro
                        ? { street_name: input.payerAddress.logradouro }
                        : {}),
                      ...(input.payerAddress?.numero
                        ? { street_number: input.payerAddress.numero }
                        : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(input.itens && input.itens.length
        ? {
            items: input.itens.map((it) => ({
              id: it.id,
              title: it.title,
              description: it.title,
              ...(it.categoryId ? { category_id: it.categoryId } : {}),
              quantity: it.quantity,
              unit_price: Math.round(it.unitPrice * 100) / 100,
            })),
          }
        : {}),
      ...(cep
        ? {
            shipments: {
              receiver_address: {
                zip_code: cep,
                ...(input.endereco?.uf ? { state_name: input.endereco.uf } : {}),
                ...(input.endereco?.cidade
                  ? { city_name: input.endereco.cidade }
                  : {}),
                ...(input.endereco?.logradouro
                  ? { street_name: input.endereco.logradouro }
                  : {}),
                ...(input.endereco?.numero
                  ? { street_number: input.endereco.numero }
                  : {}),
              },
            },
          }
        : {}),
    };

    // O corpo carrega o TOKEN (uso único) — nunca PAN/CVV; nunca logamos o body.
    const body = {
      transaction_amount: Math.round(input.valor * 100) / 100,
      token: input.token,
      description: input.descricao,
      installments: input.installments,
      payment_method_id: input.paymentMethodId,
      ...(input.issuerId ? { issuer_id: input.issuerId } : {}),
      external_reference: input.orderId,
      notification_url: NOTIFICATION_URL,
      payer: {
        email: input.pagador.email,
        ...(input.pagador.nome ? { first_name: input.pagador.nome } : {}),
        ...(input.pagador.sobrenome ? { last_name: input.pagador.sobrenome } : {}),
        ...(identification ? { identification } : {}),
        ...(phone ? { phone } : {}),
      },
      ...(Object.keys(additionalInfo).length
        ? { additional_info: additionalInfo }
        : {}),
    };

    // Device ID no header que o antifraude do MP espera. Sem ele, recusa por padrão.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (input.deviceId) headers["X-meli-session-id"] = input.deviceId;

    const data = (await mpFetch("/v1/payments", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    })) as MpPaymentResponse;

    return {
      externalId: String(data.id),
      status: mapStatus(data.status, data.status_detail),
      statusDetail: data.status_detail ?? null,
      parcelas: data.installments ?? input.installments,
      bandeira: data.payment_method_id ?? input.paymentMethodId ?? null,
    };
  },

  async consultarPagamento(externalId: string): Promise<PixConsulta> {
    const data = (await mpFetch(`/v1/payments/${externalId}`, {
      method: "GET",
    })) as MpPaymentResponse;
    return {
      externalId: String(data.id),
      status: mapStatus(data.status, data.status_detail),
      externalReference: data.external_reference ?? null,
      valor: data.transaction_amount ?? null,
      metodo: metodoDoTipoPagamento(data.payment_type_id),
      parcelas: data.installments ?? null,
      bandeira: data.payment_method_id ?? null,
    };
  },

  async estornarPagamento(
    paymentId: string,
    opts?: { idempotencyKey?: string },
  ): Promise<EstornoCriado> {
    // Corpo vazio = estorno TOTAL. X-Idempotency-Key estável (refund-{id}) → o MP
    // deduplica: 2 cliques ou webhook+botão nunca geram 2 refunds. mpFetch lança
    // (com a mensagem do MP) se falhar — o chamador não marca como estornado.
    const data = (await mpFetch(`/v1/payments/${paymentId}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      idempotencyKey: opts?.idempotencyKey ?? `refund-${paymentId}`,
    })) as { id?: number | string; status?: string };
    return { refundId: String(data.id), status: data.status ?? null };
  },

  async criarPreferencia(
    input: CriarPreferenciaInput,
  ): Promise<PreferenciaCriada> {
    const cpfCnpj = input.pagador.cpfCnpj?.replace(/\D/g, "") || null;
    const body = {
      items: input.itens.map((it) => ({
        id: it.id,
        title: it.title,
        quantity: it.quantity,
        unit_price: Math.round(it.unitPrice * 100) / 100,
        currency_id: "BRL",
      })),
      payer: {
        email: input.pagador.email,
        ...(input.pagador.nome ? { name: input.pagador.nome } : {}),
        ...(input.pagador.sobrenome ? { surname: input.pagador.sobrenome } : {}),
        ...(cpfCnpj
          ? {
              identification: {
                type: cpfCnpj.length > 11 ? "CNPJ" : "CPF",
                number: cpfCnpj,
              },
            }
          : {}),
      },
      external_reference: input.orderId,
      back_urls: input.backUrls,
      auto_return: "approved",
      notification_url: NOTIFICATION_URL,
      // Teto de parcelas (cobrança avulsa). Sem isso o MP usa o máximo da conta.
      ...(input.installmentsLimit
        ? { payment_methods: { installments: input.installmentsLimit } }
        : {}),
      // Validade do link: passou da data, o MP recusa abrir o checkout.
      ...(input.expiraEm
        ? {
            expires: true,
            expiration_date_to: isoComOffsetBrasil(input.expiraEm),
          }
        : {}),
    };

    const data = (await mpFetch("/checkout/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    })) as { id?: number | string; init_point?: string };

    return {
      preferenceId: String(data.id),
      initPoint: data.init_point ?? "",
    };
  },
};
