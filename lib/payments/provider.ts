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

export interface PaymentProvider {
  readonly nome: ProviderPagamento;
  /** Cria a cobrança Pix no gateway e devolve QR + copia-e-cola + expiração. */
  criarPagamentoPix(input: CriarPixInput): Promise<PixCriado>;
  /** Re-busca a cobrança no gateway (fonte da verdade p/ webhook e poll). */
  consultarPagamento(externalId: string): Promise<PixConsulta>;
}
