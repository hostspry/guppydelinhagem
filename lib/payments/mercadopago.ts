import "server-only";
import { randomUUID } from "node:crypto";
import {
  ProviderPagamento,
  StatusPagamento,
} from "@/lib/generated/prisma/enums";
import type {
  PaymentProvider,
  CriarPixInput,
  PixCriado,
  PixConsulta,
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

// MP status → StatusPagamento (nosso enum). status_detail distingue Pix expirado
// (cancelled + "expired") de cancelamento/recusa comum.
function mapStatus(
  mpStatus: string | undefined,
  statusDetail: string | undefined,
): StatusPagamento {
  switch (mpStatus) {
    case "approved":
      return StatusPagamento.PAGO;
    case "pending":
    case "in_process":
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

  async consultarPagamento(externalId: string): Promise<PixConsulta> {
    const data = (await mpFetch(`/v1/payments/${externalId}`, {
      method: "GET",
    })) as MpPaymentResponse;
    return {
      externalId: String(data.id),
      status: mapStatus(data.status, data.status_detail),
    };
  },
};
