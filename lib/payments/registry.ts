import "server-only";
import type { ProviderPagamento } from "@/lib/generated/prisma/client";
import type { PaymentProvider } from "./provider";
import { mercadoPagoProvider } from "./mercadopago";
import { pagBankProvider } from "./pagbank";

// Registry de providers. server-only: o checkout/webhook resolvem o provider por
// aqui (nunca o client). PicPay entra aqui quando implementado.
export const paymentProviders: Partial<
  Record<ProviderPagamento, PaymentProvider>
> = {
  MERCADO_PAGO: mercadoPagoProvider,
  PAGBANK: pagBankProvider,
};

/** Resolve um provider obrigatório (lança se não registrado). */
export function getPaymentProvider(nome: ProviderPagamento): PaymentProvider {
  const p = paymentProviders[nome];
  if (!p) throw new Error(`Provider de pagamento não disponível: ${nome}.`);
  return p;
}
