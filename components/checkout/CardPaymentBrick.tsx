"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { CartaoInput } from "@/actions/checkout";
import { relatarFalhaCartao } from "@/lib/falha-cartao";
import { carregarDeviceMp, esperarDeviceId } from "@/lib/mp-device";

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
    // Device fingerprint do MP. NÃO vem do SDK v2 — quem define é o
    // security.js carregado por lib/mp-device.
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

// Fila de montagem. O Brick re-monta quando o valor muda (trocar o frete muda o
// total), e bricks.create é assíncrono: se o cleanup rodasse antes do create
// resolver, o Brick antigo nunca era desmontado e dois ficavam no mesmo
// container, com os campos seguros brigando ("The integration with Secure
// Fields failed"). Cada montagem só começa depois que a anterior saiu.
let filaBrick: Promise<void> = Promise.resolve();

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
  payerTelefone,
  onPagar,
  onErro,
  fluxo = "checkout",
}: {
  publicKey: string;
  amount: number;
  maxInstallments: number;
  payerEmail?: string;
  payerTelefone?: string;
  onPagar: (cartao: CartaoInput) => Promise<void>;
  onErro?: (msg: string) => void;
  /** Onde o formulário está (checkout ou link de cobrança), para o registro. */
  fluxo?: "checkout" | "cobranca";
}) {
  // Refs com os callbacks/email mais recentes — evita re-montar o Brick (e perder
  // o que o cliente digitou) a cada render/keystroke.
  const onPagarRef = useRef(onPagar);
  const onErroRef = useRef(onErro);
  const emailRef = useRef(payerEmail);
  const telefoneRef = useRef(payerTelefone);
  const amountRef = useRef(amount);
  useEffect(() => {
    onPagarRef.current = onPagar;
    onErroRef.current = onErro;
    emailRef.current = payerEmail;
    telefoneRef.current = payerTelefone;
    amountRef.current = amount;
  });

  // Falha aqui não chega ao gateway e não cria pedido: sem este registro, a
  // tentativa some e o dono só descobre se o cliente contar. Nunca manda dado de
  // cartão — o número e o CVV ficam no iframe do gateway e nem passam por aqui.
  function relatar(
    etapa: "SDK" | "FORMULARIO" | "ABERTO" | "ENVIO",
    mensagem: string,
    parcelas?: number,
  ) {
    relatarFalhaCartao({
      etapa,
      mensagem,
      valor: amountRef.current,
      parcelas,
      email: emailRef.current,
      telefone: telefoneRef.current,
      fluxo,
    });
  }

  // Funil: conta UMA abertura por visita, mesmo que o Brick re-monte ao trocar
  // o frete. Sem isso não dá para saber se ninguém tenta o cartão ou se tenta
  // e trava.
  const abriu = useRef(false);

  const carregando = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelado = false;
    const anterior = filaBrick;
    let liberar!: () => void;
    filaBrick = new Promise<void>((r) => (liberar = r));

    // Resolve com o Brick montado (ou null). Mesmo cancelado no meio, devolve o
    // controller para o cleanup desmontar: um Brick nunca fica órfão.
    const montagem = (async (): Promise<MpBrickController | null> => {
      try {
        // Fingerprint em paralelo ao SDK: a coleta é assíncrona e queremos que
        // esteja pronta quando o cliente terminar de digitar o cartão.
        carregarDeviceMp("checkout");
        await anterior;
        await carregarSdk();
        if (cancelado || !window.MercadoPago) return null;
        if (carregando.current) carregando.current.style.display = "";
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });
        const bricks = mp.bricks();
        return await bricks.create("cardPayment", CONTAINER_ID, {
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
              if (!abriu.current) {
                abriu.current = true;
                relatar("ABERTO", "formulário de cartão pronto");
              }
            },
            onError: (err: { message?: string }) => {
              const msg = err?.message ?? "Erro no formulário de cartão.";
              relatar("FORMULARIO", msg);
              onErroRef.current?.(msg);
            },
            onSubmit: async (formData: CardBrickFormData) => {
              relatar(
                "ENVIO",
                `clicou em Pagar (${formData.payment_method_id ?? "?"})`,
                Number(formData.installments) || undefined,
              );
              return onPagarRef.current({
                token: formData.token,
                paymentMethodId: formData.payment_method_id,
                issuerId:
                  formData.issuer_id != null ? String(formData.issuer_id) : null,
                installments: Number(formData.installments),
                // Device ID → header X-meli-session-id no backend. Espera a coleta
                // terminar (poucos segundos) em vez de ler a variável na hora: se
                // for null, o antifraude recusa cartão bom por falta de sinal.
                deviceId: await esperarDeviceId(),
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
              });
            },
          },
        });
      } catch (e) {
        if (!cancelado) {
          const msg = e instanceof Error ? e.message : "Falha ao carregar o cartão.";
          relatar("SDK", msg);
          onErroRef.current?.(msg);
        }
        return null;
      }
    })();

    return () => {
      cancelado = true;
      montagem
        .then((controller) => controller?.unmount())
        .catch(() => {})
        .finally(liberar);
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
