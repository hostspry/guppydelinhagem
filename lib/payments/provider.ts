import type {
  ProviderPagamento,
  MetodoPagamento,
  StatusPagamento,
} from "@/lib/generated/prisma/client";

// Contrato de provider de pagamento. NÃO implementado nesta fase — só a interface
// tipada, pra costurar a fase de Pagamentos (gateways + webhooks) sem retrabalho.

export interface CriarCobrancaInput {
  pedidoId: string;
  valor: number;
  metodo: MetodoPagamento;
}

export interface CobrancaResult {
  externalId: string;
  status: StatusPagamento;
  linkPagamento?: string;
  qrCode?: string;
}

export interface PaymentProvider {
  readonly nome: ProviderPagamento;
  criarCobranca(input: CriarCobrancaInput): Promise<CobrancaResult>;
  consultarStatus(externalId: string): Promise<StatusPagamento>;
  tratarWebhook(
    payload: unknown,
  ): Promise<{ externalId: string; status: StatusPagamento } | null>;
}
