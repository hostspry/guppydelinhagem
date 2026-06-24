import type {
  ProviderPagamento,
  StatusPagamento,
} from "@/lib/generated/prisma/client";

// Contrato de provider de pagamento — Pix (Checkout Transparente). O QR Code fica
// dentro do site. Cartão é fase futura (não faz parte deste contrato ainda).

export interface PixPagador {
  nome?: string | null;
  sobrenome?: string | null;
  email: string;
  cpfCnpj?: string | null; // só dígitos; vira identification CPF/CNPJ no MP
}

export interface CriarPixInput {
  orderId: string; // vira external_reference no gateway
  valor: number; // BRL (reais)
  descricao: string;
  pagador: PixPagador;
  /** X-Idempotency-Key (anti-duplicidade). Default: UUID por chamada. */
  idempotencyKey?: string;
}

export interface PixCriado {
  externalId: string; // id da cobrança no gateway
  status: StatusPagamento;
  qrCode: string | null; // "copia e cola" (EMV) — vai pra Pagamento.qrCode
  qrCodeBase64: string | null; // imagem PNG em base64 (sem prefixo data:)
  copiaECola: string | null; // = qrCode (conveniência pra UI)
  ticketUrl: string | null; // página de pagamento do gateway (fallback)
  expiraEm: Date | null;
}

export interface PixConsulta {
  externalId: string;
  status: StatusPagamento;
  externalReference: string | null; // = orderId (external_reference no gateway)
}

// ── Cartão de crédito (token gerado no NAVEGADOR pelo Card Brick) ─────────────
// O servidor recebe só o token (uso único) + dados não sensíveis — nunca PAN/CVV.
export interface CartaoPagador {
  email: string;
  cpfCnpj?: string | null;
  nome?: string | null; // first_name (antifraude MP)
  sobrenome?: string | null; // last_name
  telefone?: string | null; // só dígitos; provider separa area_code/number
}

// Endereço de entrega p/ additional_info.shipments.receiver_address (antifraude).
export interface CartaoEndereco {
  cep?: string | null; // só dígitos → zip_code
  uf?: string | null; // → state_name
  cidade?: string | null; // → city_name
  logradouro?: string | null; // → street_name
  numero?: string | null; // → street_number
}

// Item p/ additional_info.items (sinal de antifraude — o MP usa pra aprovar).
export interface CartaoItem {
  id: string;
  title: string;
  categoryId?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface CriarCartaoInput {
  orderId: string; // vira external_reference
  valor: number; // BRL (recalculado no servidor)
  descricao: string;
  token: string; // token de uso único do cartão (do Brick)
  paymentMethodId: string; // bandeira: "visa"/"master"/… (do Brick)
  issuerId?: string | null; // emissor (do Brick)
  installments: number; // nº de parcelas escolhido
  pagador: CartaoPagador;
  // Device fingerprint do MP (window.MP_DEVICE_SESSION_ID) → header
  // X-meli-session-id. Sem ele o antifraude do MP recusa cartões legítimos.
  deviceId?: string | null;
  endereco?: CartaoEndereco | null; // → additional_info.shipments
  itens?: CartaoItem[]; // → additional_info.items
  idempotencyKey?: string;
}

export interface CartaoCriado {
  externalId: string;
  status: StatusPagamento; // PAGO | EM_ANALISE | RECUSADO
  statusDetail: string | null; // motivo (mapeia p/ mensagem amigável)
  parcelas: number;
  bandeira: string | null; // payment_method_id (só exibição)
}

export interface PaymentProvider {
  readonly nome: ProviderPagamento;
  /** Cria a cobrança Pix no gateway e devolve QR + copia-e-cola + expiração. */
  criarPagamentoPix(input: CriarPixInput): Promise<PixCriado>;
  /** Cria o pagamento com cartão (token do Brick) e devolve o desfecho. */
  criarPagamentoCartao(input: CriarCartaoInput): Promise<CartaoCriado>;
  /** Re-busca a cobrança no gateway (fonte da verdade p/ webhook e poll). */
  consultarPagamento(externalId: string): Promise<PixConsulta>;
}
