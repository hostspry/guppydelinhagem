import type {
  ProviderPagamento,
  StatusPagamento,
  MetodoPagamento,
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
  // Dados extras p/ o webhook CRIAR a linha Pagamento quando ela ainda não existe
  // (Checkout Pro: o pagamento nasce no MP, sem registro local prévio).
  valor?: number | null;
  metodo?: MetodoPagamento | null;
  parcelas?: number | null;
  bandeira?: string | null;
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
  // ── Mercado Pago (Card Brick): token de uso único tokenizado no navegador ──
  token?: string; // token de uso único do cartão (do Brick)
  paymentMethodId?: string; // bandeira: "visa"/"master"/… (do Brick)
  issuerId?: string | null; // emissor (do Brick)
  // ── PagBank: cartão CRIPTOGRAFADO no navegador (nunca PAN/CVV no servidor) ──
  cartaoCriptografado?: string | null; // charges[].payment_method.card.encrypted
  holderNome?: string | null; // nome impresso no cartão (payment_method.card.holder.name)
  // id da autenticação 3DS já concluída no navegador (§7). Vazio = sem 3DS.
  threeDsId?: string | null;
  installments: number; // nº de parcelas escolhido
  pagador: CartaoPagador;
  // Device fingerprint do MP (window.MP_DEVICE_SESSION_ID) → header
  // X-meli-session-id. Sem ele o antifraude do MP recusa cartões legítimos.
  deviceId?: string | null;
  endereco?: CartaoEndereco | null; // → additional_info.shipments.receiver_address (onde recebe)
  // Endereço do PAGADOR → additional_info.payer.address. Separado do shipments: na
  // retirada o shipments é a loja, mas não há endereço do pagador (fica null/omitido).
  payerAddress?: CartaoEndereco | null;
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

// Estorno (refund) — devolução do dinheiro ao cliente.
export interface EstornoCriado {
  refundId: string; // id do refund no gateway (snapshot)
  status: string | null; // status do refund (ex.: "approved")
}

// ── Sessão 3DS (PagBank) — criada no servidor, consumida pelo SDK no navegador ─
export interface Sessao3ds {
  session: string; // valor usado pelo SDK 3DS no navegador
  expiresAt: number | null; // epoch ms (sessão vale ~30 min)
}

// ── Checkout Pro (Wallet) — pagamento no ambiente do próprio Mercado Pago ──────
// O cliente paga logado (saldo/cartões salvos); o MP aprova mais. Cria-se uma
// "preference" e o cliente é levado ao init_point. A confirmação vem do webhook.
export interface PreferenciaItem {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number; // BRL — valor do banco
}

export interface CriarPreferenciaInput {
  orderId: string; // vira external_reference
  itens: PreferenciaItem[];
  pagador: {
    nome?: string | null;
    sobrenome?: string | null;
    email: string;
    cpfCnpj?: string | null;
  };
  backUrls: { success: string; failure: string; pending: string };
  idempotencyKey?: string;
}

export interface PreferenciaCriada {
  preferenceId: string;
  initPoint: string; // URL do ambiente do MP p/ redirecionar o cliente
}

export interface PaymentProvider {
  readonly nome: ProviderPagamento;
  /** Cria a cobrança Pix no gateway e devolve QR + copia-e-cola + expiração. */
  criarPagamentoPix(input: CriarPixInput): Promise<PixCriado>;
  /** Cria o pagamento com cartão (token do Brick) e devolve o desfecho. */
  criarPagamentoCartao(input: CriarCartaoInput): Promise<CartaoCriado>;
  /** Re-busca a cobrança no gateway (fonte da verdade p/ webhook e poll). */
  consultarPagamento(externalId: string): Promise<PixConsulta>;
  /**
   * Estorno TOTAL do pagamento no gateway. Idempotente via idempotencyKey estável
   * (refund-{paymentId}) — o gateway deduplica. Lança em erro do gateway (já
   * estornado, fora do prazo, sem saldo) — o chamador NÃO marca como estornado.
   */
  estornarPagamento(
    paymentId: string,
    opts?: { idempotencyKey?: string },
  ): Promise<EstornoCriado>;
  /**
   * Cria uma preference (Checkout Pro) e devolve o init_point p/ redirecionar o
   * cliente ao ambiente do MP. Valor/itens vêm do banco; external_reference = orderId.
   * Só o Mercado Pago (Wallet) suporta de fato; os demais providers lançam.
   */
  criarPreferencia(input: CriarPreferenciaInput): Promise<PreferenciaCriada>;
  /**
   * Cria uma sessão de autenticação 3DS (POST /checkout-sdk/sessions) p/ o SDK do
   * navegador rodar o 3-D Secure. Opcional — só o PagBank implementa.
   */
  criar3dsSession?(): Promise<Sessao3ds>;
}
