"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { CartaoInput } from "@/actions/checkout";

// Dados que o Brick devolve no onSubmit (campos seguros ficam no iframe do MP;
// aqui só chega o TOKEN de uso único + dados não sensíveis — nunca PAN/CVV).
type CardBrickFormData = {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number | null;
  installments: number | string;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
};

type MpBrickController = { unmount: () => void };
type MpBricks = {
  create: (
    type: "cardPayment",
    container: string,
    settings: unknown,
  ) => Promise<MpBrickController>;
};
type MpInstance = { bricks: () => MpBricks };
type MpConstructor = new (
  publicKey: string,
  options?: { locale?: string },
) => MpInstance;

declare global {
  interface Window {
    MercadoPago?: MpConstructor;
    // Device fingerprint criado automaticamente pelo SDK v2 do MP ao carregar.
    MP_DEVICE_SESSION_ID?: string;
  }
}

const SDK_SRC = "https://sdk.mercadopago.com/js/v2";
const CONTAINER_ID = "cardPaymentBrick_container";

let sdkPromise: Promise<void> | null = null;
function carregarSdk(): Promise<void> {
  if (typeof window !== "undefined" && window.MercadoPago) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("Falha ao carregar o Mercado Pago."));
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

/**
 * Card Payment Brick (campos seguros do MP em iframe). Tokeniza o cartão no
 * NAVEGADOR e entrega ao pai só o token + bandeira + parcelas via onPagar. O pai
 * faz a validação do checkout e chama a action pagarComCartao. Re-monta quando o
 * total (amount) ou o teto de parcelas mudam.
 */
export default function CardPaymentBrick({
  publicKey,
  amount,
  maxInstallments,
  payerEmail,
  onPagar,
  onErro,
}: {
  publicKey: string;
  amount: number;
  maxInstallments: number;
  payerEmail?: string;
  onPagar: (cartao: CartaoInput) => Promise<void>;
  onErro?: (msg: string) => void;
}) {
  // Refs com os callbacks/email mais recentes — evita re-montar o Brick (e perder
  // o que o cliente digitou) a cada render/keystroke.
  const onPagarRef = useRef(onPagar);
  const onErroRef = useRef(onErro);
  const emailRef = useRef(payerEmail);
  useEffect(() => {
    onPagarRef.current = onPagar;
    onErroRef.current = onErro;
    emailRef.current = payerEmail;
  });

  const carregando = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let controller: MpBrickController | null = null;
    let cancelado = false;

    (async () => {
      try {
        await carregarSdk();
        if (cancelado || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const bricks = mp.bricks();
        controller = await bricks.create("cardPayment", CONTAINER_ID, {
          initialization: {
            amount,
            ...(emailRef.current ? { payer: { email: emailRef.current } } : {}),
          },
          customization: {
            paymentMethods: { maxInstallments },
            visual: { hidePaymentButton: false },
          },
          callbacks: {
            onReady: () => {
              if (carregando.current) carregando.current.style.display = "none";
            },
            onError: (err: { message?: string }) => {
              onErroRef.current?.(
                err?.message ?? "Erro no formulário de cartão.",
              );
            },
            onSubmit: (formData: CardBrickFormData) =>
              onPagarRef.current({
                token: formData.token,
                paymentMethodId: formData.payment_method_id,
                issuerId:
                  formData.issuer_id != null ? String(formData.issuer_id) : null,
                installments: Number(formData.installments),
                // Device ID do MP (capturado pelo SDK v2) — vai ao backend e de lá
                // pro header X-meli-session-id. Sem ele o antifraude recusa.
                deviceId:
                  typeof window !== "undefined"
                    ? (window.MP_DEVICE_SESSION_ID ?? null)
                    : null,
                // payer fiel ao que o Brick devolveu (sem reordenar/substituir).
                payer: formData.payer
                  ? {
                      email: formData.payer.email ?? null,
                      identification: formData.payer.identification
                        ? {
                            type: formData.payer.identification.type ?? null,
                            number: formData.payer.identification.number ?? null,
                          }
                        : null,
                    }
                  : null,
              }),
          },
        });
      } catch (e) {
        if (!cancelado) {
          onErroRef.current?.(
            e instanceof Error ? e.message : "Falha ao carregar o cartão.",
          );
        }
      }
    })();

    return () => {
      cancelado = true;
      controller?.unmount();
    };
  }, [publicKey, amount, maxInstallments]);

  return (
    <div className="space-y-2">
      <div
        ref={carregando}
        className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
      >
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Carregando pagamento seguro…
      </div>
      <div id={CONTAINER_ID} />
    </div>
  );
}
