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
  PreferenciaCriada,
  CriarBoletoInput,
  BoletoCriado,
  Sessao3ds,
} from "../provider";
import {
  pagbankApiBase,
  pagbankSdkBase,
  pagbankToken,
} from "./config";

// Provider PagBank — Order API (POST /orders): cria e paga em uma requisição.
// Cartão (com 3DS), Pix (qr_codes) e Boleto. Token Bearer server-only (nunca vai
// ao client — `server-only` quebra o build se importado de Client Component).
//
// Doc: developer.pagbank.com.br — Pedidos e pagamentos (Order). TODOS os valores
// monetários vão em CENTAVOS (inteiro): R$ 342,00 → 34200 (gotcha nº 1 vs. o MP,
// que usa reais decimal).

// URL do webhook registrada nos pedidos (a mesma valida a assinatura).
const NOTIFICATION_URL =
  "https://www.guppydelinhagem.com.br/api/webhooks/pagbank";

// Janela de validade do Pix (min). Spec do checkout: 30 min (igual ao MP).
const PIX_EXPIRACAO_MIN = 30;
// Dias até o vencimento do boleto.
const BOLETO_DIAS_VENCIMENTO = 3;

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

// payment_method.type do PagBank → nosso MetodoPagamento (p/ o webhook criar a
// linha Pagamento quando ela ainda não existe).
function metodoDoTipo(tipo: string | undefined): MetodoPagamento {
  switch (tipo) {
    case "CREDIT_CARD":
    case "DEBIT_CARD":
      return MetodoPagamento.CARTAO;
    case "BOLETO":
      return MetodoPagamento.BOLETO;
    case "PIX":
      return MetodoPagamento.PIX;
    default:
      return MetodoPagamento.PIX;
  }
}

// payment_response.code de recusa (§ Motivos de compra negada) → frase PT. Sem a
// tabela completa oficial, mapeia os casos conhecidos e cai num fallback amigável.
export function mensagemRecusaPagbank(
  code: string | null | undefined,
): string {
  switch (code) {
    case "10000":
      return "Pagamento não autorizado pelo emissor. Tente outro cartão.";
    case "10001":
      return "Saldo ou limite insuficiente.";
    case "10002":
      return "Cartão vencido. Confira a validade ou use outro.";
    case "10003":
      return "Código de segurança (CVV) incorreto.";
    case "10004":
      return "Dados do cartão incorretos. Confira e tente de novo.";
    case "10006":
      return "Autorize o pagamento com o emissor do seu cartão e tente de novo.";
    default:
      return "Pagamento recusado. Tente outro cartão.";
  }
}

// Telefone BR (só dígitos) → objeto phones[] do PagBank. <10 dígitos → null.
function telefonePagbank(
  tel: string | null | undefined,
): { country: string; area: string; number: string; type: "MOBILE" } | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return { country: "55", area: d.slice(0, 2), number: d.slice(2), type: "MOBILE" };
}

// ISO 8601 com offset -03:00 (Brasil sem horário de verão) p/ expiration_date.
function isoOffsetBrasil(d: Date): string {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const p = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}-03:00`
  );
}

// YYYY-MM-DD (data local BR) p/ o vencimento do boleto.
function dataBrasil(d: Date): string {
  const local = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}`;
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
    boleto?: {
      barcode?: string;
      formatted_barcode?: string;
      due_date?: string;
    };
  };
  links?: { rel?: string; href?: string; media?: string }[];
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

  async criarPagamentoPix(input: CriarPixInput): Promise<PixCriado> {
    const expiraEm = new Date(Date.now() + PIX_EXPIRACAO_MIN * 60 * 1000);
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
      items: [
        { name: input.descricao, quantity: 1, unit_amount: centavos(input.valor) },
      ],
      qr_codes: [
        {
          amount: { value: centavos(input.valor) },
          expiration_date: isoOffsetBrasil(expiraEm),
        },
      ],
      notification_urls: [NOTIFICATION_URL],
    };

    const data = (await pagbankFetch("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    })) as OrderResponse;

    const qr = data.qr_codes?.[0];
    const pngLink =
      qr?.links?.find((l) => l.rel === "QRCODE.PNG")?.href ?? null;
    return {
      // Antes do pagamento não há charge; guardamos o id do QR (o webhook depois
      // reconcilia pelo reference_id e grava o charge.id).
      externalId: qr?.id ?? data.id ?? "",
      status: StatusPagamento.PENDENTE,
      qrCode: qr?.text ?? null,
      qrCodeBase64: null, // PagBank entrega o PNG por link, não base64 embutido
      copiaECola: qr?.text ?? null,
      ticketUrl: pngLink, // link do PNG do QR (fallback visual)
      expiraEm: qr?.expiration_date ? new Date(qr.expiration_date) : expiraEm,
    };
  },

  async criarPagamentoCartao(input: CriarCartaoInput): Promise<CartaoCriado> {
    if (!input.cartaoCriptografado) {
      throw new Error("Cartão não criptografado.");
    }
    const cpf = input.pagador.cpfCnpj?.replace(/\D/g, "") || null;
    const nome =
      [input.pagador.nome, input.pagador.sobrenome].filter(Boolean).join(" ") ||
      input.pagador.email;
    const phone = telefonePagbank(input.pagador.telefone);

    const body = {
      reference_id: input.orderId,
      customer: {
        name: nome,
        email: input.pagador.email,
        ...(cpf ? { tax_id: cpf } : {}),
        ...(phone ? { phones: [phone] } : {}),
      },
      items: [
        { name: input.descricao, quantity: 1, unit_amount: centavos(input.valor) },
      ],
      charges: [
        {
          reference_id: input.orderId,
          description: input.descricao,
          amount: { value: centavos(input.valor), currency: "BRL" },
          payment_method: {
            type: "CREDIT_CARD",
            installments: input.installments,
            capture: true,
            card: {
              encrypted: input.cartaoCriptografado,
              store: false,
            },
            holder: {
              name: input.holderNome || nome,
              ...(cpf ? { tax_id: cpf } : {}),
            },
            // 3DS: só envia se a autenticação foi concluída no navegador (§7).
            ...(input.threeDsId
              ? {
                  authentication_method: {
                    type: "THREEDS",
                    id: input.threeDsId,
                  },
                }
              : {}),
          },
        },
      ],
      notification_urls: [NOTIFICATION_URL],
    };

    const data = (await pagbankFetch("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    })) as OrderResponse;

    const charge = data.charges?.[0];
    return {
      externalId: charge?.id ?? "",
      status: mapChargeStatus(
        charge?.status,
        charge?.amount?.summary?.refunded,
      ),
      statusDetail: charge?.payment_response?.code ?? null,
      parcelas: charge?.payment_method?.installments ?? input.installments,
      bandeira: charge?.payment_method?.card?.brand ?? null,
    };
  },

  async gerarBoleto(input: CriarBoletoInput): Promise<BoletoCriado> {
    const cpf = input.pagador.cpfCnpj.replace(/\D/g, "");
    const vencimento = new Date(
      Date.now() + BOLETO_DIAS_VENCIMENTO * 24 * 60 * 60 * 1000,
    );
    const end = input.pagador.endereco;

    const body = {
      reference_id: input.orderId,
      customer: {
        name: input.pagador.nome,
        email: input.pagador.email,
        tax_id: cpf,
      },
      items: [
        { name: input.descricao, quantity: 1, unit_amount: centavos(input.valor) },
      ],
      charges: [
        {
          reference_id: input.orderId,
          description: input.descricao,
          amount: { value: centavos(input.valor), currency: "BRL" },
          payment_method: {
            type: "BOLETO",
            boleto: {
              due_date: dataBrasil(vencimento),
              instruction_lines: {
                line_1: "Pagamento processado para a Guppy de Linhagem",
                line_2: "Não receber após o vencimento",
              },
              holder: {
                name: input.pagador.nome,
                tax_id: cpf,
                email: input.pagador.email,
                address: {
                  street: end.logradouro,
                  number: end.numero,
                  locality: end.bairro || end.cidade,
                  city: end.cidade,
                  region_code: end.uf,
                  country: "Brasil",
                  postal_code: end.cep.replace(/\D/g, ""),
                },
              },
            },
          },
        },
      ],
      notification_urls: [NOTIFICATION_URL],
    };

    const data = (await pagbankFetch("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    })) as OrderResponse;

    const charge = data.charges?.[0];
    const boleto = charge?.payment_method?.boleto;
    const pdf =
      charge?.links?.find(
        (l) => l.rel === "SELF" && l.media === "application/pdf",
      )?.href ??
      charge?.links?.find((l) => (l.href ?? "").includes(".pdf"))?.href ??
      null;
    return {
      externalId: charge?.id ?? "",
      status: mapChargeStatus(charge?.status),
      linhaDigitavel: boleto?.formatted_barcode ?? null,
      codigoBarras: boleto?.barcode ?? null,
      linkPdf: pdf,
      vencimento: boleto?.due_date ? new Date(boleto.due_date) : vencimento,
    };
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
        metodo: metodoDoTipo(charge?.payment_method?.type),
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
      metodo: metodoDoTipo(charge.payment_method?.type),
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

  async criar3dsSession(): Promise<Sessao3ds> {
    // POST /checkout-sdk/sessions no HOST do SDK (não na base da Order API). Sem
    // corpo. A sessão vale ~30 min e é consumida pelo SDK 3DS no navegador.
    const data = (await pagbankFetch("/checkout-sdk/sessions", {
      method: "POST",
      base: pagbankSdkBase(),
      headers: { "Content-Type": "application/json" },
    })) as { session?: string; expires_at?: number };
    if (!data.session) {
      throw new Error("Não foi possível iniciar a autenticação 3DS.");
    }
    return { session: data.session, expiresAt: data.expires_at ?? null };
  },

  // Checkout Pro (Wallet) é exclusivo do Mercado Pago — não faz parte do PagBank.
  async criarPreferencia(): Promise<PreferenciaCriada> {
    throw new Error("Checkout Pro não é suportado pelo PagBank.");
  },
};
