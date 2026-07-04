import "server-only";
import { randomUUID } from "node:crypto";
import {
  ProviderPagamento,
  StatusPagamento,
  MetodoPagamento,
} from "@/lib/generated/prisma/enums";
import type {
  PaymentProvider,
  PixCriado,
  PixConsulta,
  CartaoCriado,
  EstornoCriado,
  CriarPreferenciaInput,
  PreferenciaCriada,
} from "../provider";
import { pagbankApiBase, pagbankToken } from "./config";

// Provider PagBank — Checkout hospedado (POST /checkouts): o cliente digita o
// cartão na PÁGINA do PagBank (que cuida de criptografia, 3DS e antifraude) e
// volta pro site. Escopo card-only: existe como 2º adquirente pra recuperar cartão
// recusado pela antifraude do Mercado Pago. Pix é exclusivo do MP e boleto foi
// descontinuado. Token Bearer server-only (nunca vai ao client — `server-only`
// quebra o build se importado de Client Component).
//
// Doc: developer.pagbank.com.br — Pedidos e pagamentos (Order). TODOS os valores
// monetários vão em CENTAVOS (inteiro): R$ 342,00 → 34200 (gotcha nº 1 vs. o MP,
// que usa reais decimal).

// URL do webhook registrada nos pedidos (a mesma valida a assinatura).
const NOTIFICATION_URL =
  "https://www.guppydelinhagem.com.br/api/webhooks/pagbank";

/** Reais (number, 2 casas) → centavos inteiro. Gotcha nº 1 do PagBank. */
function centavos(valorReais: number): number {
  return Math.round(valorReais * 100);
}

// Status da charge PagBank → StatusPagamento (nosso enum). Fonte: Objeto Charge.
//   PAID/AUTHORIZED → PAGO (capture:true garante captura)
//   IN_ANALYSIS     → EM_ANALISE (não baixa estoque ainda)
//   WAITING         → PENDENTE (pix/boleto aguardando pagamento)
//   DECLINED        → RECUSADO
//   CANCELED        → ESTORNADO se houve reembolso; senão RECUSADO
function mapChargeStatus(
  status: string | undefined,
  refundedCentavos?: number,
): StatusPagamento {
  switch (status) {
    case "PAID":
    case "AUTHORIZED":
      return StatusPagamento.PAGO;
    case "IN_ANALYSIS":
      return StatusPagamento.EM_ANALISE;
    case "WAITING":
      return StatusPagamento.PENDENTE;
    case "DECLINED":
      return StatusPagamento.RECUSADO;
    case "CANCELED":
      return (refundedCentavos ?? 0) > 0
        ? StatusPagamento.ESTORNADO
        : StatusPagamento.RECUSADO;
    default:
      return StatusPagamento.PENDENTE;
  }
}

type ChargeResponse = {
  id?: string;
  reference_id?: string;
  status?: string;
  amount?: {
    value?: number;
    summary?: { total?: number; paid?: number; refunded?: number };
  };
  payment_response?: { code?: string; message?: string };
  payment_method?: {
    type?: string;
    installments?: number;
    card?: { brand?: string };
  };
};

type OrderResponse = {
  id?: string;
  reference_id?: string;
  charges?: ChargeResponse[];
  qr_codes?: {
    id?: string;
    text?: string;
    expiration_date?: string;
    amount?: { value?: number };
    links?: { rel?: string; href?: string; media?: string }[];
  }[];
};

/**
 * Cliente HTTP fino do PagBank. Bearer token + headers padrão + chave de
 * idempotência opcional (x-idempotency-key) nas criações/cancelamentos. `base`
 * permite trocar p/ o host do SDK (sessão 3DS). Nunca loga o corpo (pode conter
 * cartão criptografado). Lança com a mensagem do PagBank em erro.
 */
async function pagbankFetch(
  path: string,
  init: RequestInit & { idempotencyKey?: string; base?: string },
): Promise<unknown> {
  const { idempotencyKey, base, ...rest } = init;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${pagbankToken()}`,
    ...(rest.headers as Record<string, string> | undefined),
  };
  if (idempotencyKey) headers["x-idempotency-key"] = idempotencyKey;

  let resp: Response;
  try {
    resp = await fetch(`${base ?? pagbankApiBase()}${path}`, {
      ...rest,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new Error("Não foi possível falar com o PagBank agora.");
  }

  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!resp.ok) {
    // error_messages[] é o formato de erro do PagBank; cai na mensagem simples.
    const errs = (data as { error_messages?: { description?: string }[] } | null)
      ?.error_messages;
    const msg =
      (errs && errs[0]?.description) ||
      (data as { message?: string } | null)?.message ||
      `PagBank respondeu ${resp.status}.`;
    console.error("[pagbank]", path, resp.status, msg);
    throw new Error(msg);
  }
  return data;
}

export const pagBankProvider: PaymentProvider = {
  nome: ProviderPagamento.PAGBANK,

  // Pix é exclusivo do Mercado Pago — o PagBank (card-only) não emite Pix.
  async criarPagamentoPix(): Promise<PixCriado> {
    throw new Error("Pix não é suportado pelo PagBank.");
  },

  // Cobrança direta de cartão não é suportada: o cartão é digitado na página
  // hospedada do PagBank (ver criarPreferencia → POST /checkouts). Isso tira do
  // nosso front a criptografia e o 3DS (que davam 400) e reduz o escopo PCI.
  async criarPagamentoCartao(): Promise<CartaoCriado> {
    throw new Error(
      "Cartão direto não é suportado pelo PagBank; use o checkout hospedado.",
    );
  },

  async consultarPagamento(externalId: string): Promise<PixConsulta> {
    // Aceita id de ORDER (ORDE_) ou de CHARGE (CHAR_). O webhook manda o id do
    // pedido; estorno/poll usam o id da charge. Fonte da verdade sempre no PagBank.
    const isOrder = externalId.startsWith("ORDE");
    const path = isOrder
      ? `/orders/${externalId}`
      : `/charges/${externalId}`;
    const data = (await pagbankFetch(path, { method: "GET" })) as
      | OrderResponse
      | ChargeResponse;

    if (isOrder) {
      const order = data as OrderResponse;
      const charge = order.charges?.[0];
      // Pix ainda não pago: sem charge, mas o pedido existe (WAITING).
      const status = charge
        ? mapChargeStatus(charge.status, charge.amount?.summary?.refunded)
        : StatusPagamento.PENDENTE;
      return {
        externalId: charge?.id ?? order.id ?? externalId,
        status,
        externalReference: order.reference_id ?? null,
        valor:
          charge?.amount?.value != null
            ? charge.amount.value / 100
            : order.qr_codes?.[0]?.amount?.value != null
              ? (order.qr_codes[0].amount!.value as number) / 100
              : null,
        metodo: MetodoPagamento.CARTAO, // card-only
        parcelas: charge?.payment_method?.installments ?? null,
        bandeira: charge?.payment_method?.card?.brand ?? null,
      };
    }

    const charge = data as ChargeResponse;
    return {
      externalId: charge.id ?? externalId,
      status: mapChargeStatus(charge.status, charge.amount?.summary?.refunded),
      externalReference: charge.reference_id ?? null,
      valor: charge.amount?.value != null ? charge.amount.value / 100 : null,
      metodo: MetodoPagamento.CARTAO, // card-only
      parcelas: charge.payment_method?.installments ?? null,
      bandeira: charge.payment_method?.card?.brand ?? null,
    };
  },

  async estornarPagamento(
    chargeId: string,
    opts?: { idempotencyKey?: string },
  ): Promise<EstornoCriado> {
    // POST /charges/{id}/cancel — corpo vazio = cancelamento/estorno TOTAL. Chave
    // de idempotência estável (refund-{chargeId}) dedup no PagBank. Lança em erro;
    // o chamador NÃO marca como estornado.
    const data = (await pagbankFetch(`/charges/${chargeId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      idempotencyKey: opts?.idempotencyKey ?? `refund-${chargeId}`,
    })) as ChargeResponse;
    return { refundId: data.id ?? chargeId, status: data.status ?? null };
  },

  // Checkout hospedado (POST /checkouts): cria a página de pagamento do PagBank
  // restrita a CARTÃO e devolve o link (links[] rel PAY) pra redirecionar o
  // cliente. O PagBank cuida da digitação do cartão + 3DS + antifraude; a
  // confirmação volta pelo webhook (notification_urls). Valores em centavos.
  async criarPreferencia(
    input: CriarPreferenciaInput,
  ): Promise<PreferenciaCriada> {
    const cpf = input.pagador.cpfCnpj?.replace(/\D/g, "") || null;
    const nome =
      [input.pagador.nome, input.pagador.sobrenome].filter(Boolean).join(" ") ||
      input.pagador.email;

    const body = {
      reference_id: input.orderId,
      customer: {
        name: nome,
        email: input.pagador.email,
        ...(cpf ? { tax_id: cpf } : {}),
      },
      items: input.itens.map((it) => ({
        name: it.title,
        quantity: it.quantity,
        unit_amount: centavos(it.unitPrice),
      })),
      // Card-only na página hospedada (Pix é do MP; boleto descontinuado).
      payment_methods: [{ type: "CREDIT_CARD" }],
      ...(input.installmentsLimit
        ? {
            payment_methods_configs: [
              {
                type: "CREDIT_CARD",
                config_options: [
                  {
                    option: "INSTALLMENTS_LIMIT",
                    value: String(input.installmentsLimit),
                  },
                ],
              },
            ],
          }
        : {}),
      // Cliente volta pra cá após pagar; a confirmação real vem do webhook.
      redirect_url: input.backUrls.success,
      notification_urls: [NOTIFICATION_URL],
      payment_notification_urls: [NOTIFICATION_URL],
    };

    const data = (await pagbankFetch("/checkouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    })) as { id?: string; links?: { rel?: string; href?: string }[] };

    const pay = data.links?.find((l) => l.rel === "PAY")?.href ?? null;
    if (!pay) {
      throw new Error("Não foi possível iniciar o checkout do PagBank.");
    }
    return { preferenceId: data.id ?? "", initPoint: pay };
  },
};
