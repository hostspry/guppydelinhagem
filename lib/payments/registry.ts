import type { ProviderPagamento } from "@/lib/generated/prisma/client";
import type { PaymentProvider } from "./provider";

// Implementações (Mercado Pago, PicPay, …) entram na fase de Pagamentos.
export const paymentProviders: Partial<
  Record<ProviderPagamento, PaymentProvider>
> = {};
