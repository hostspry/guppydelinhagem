"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { formatBRL } from "@/lib/utils/format";
import { criar3dsSessionPagbank, type CartaoPagbankInput } from "@/actions/checkout";

// SDK Connect JS do PagBank (mesmo arquivo p/ criptografia de cartão + 3DS).
const SDK_SRC =
  "https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js";

type EncryptResult = {
  encryptedCard: string;
  hasErrors: boolean;
  errors?: { code?: string; message?: string }[];
};
type Auth3dsResult = { status: string; id?: string };
type PagSeguroSDK = {
  encryptCard(args: {
    publicKey: string;
    holder: string;
    number: string;
    expMonth: string;
    expYear: string;
    securityCode: string;
  }): EncryptResult;
  setUp(args: { session: string; env: "PROD" | "SANDBOX" }): void;
  authenticate3DS(args: { data: unknown }): Promise<Auth3dsResult>;
};

declare global {
  interface Window {
    PagSeguro?: PagSeguroSDK;
  }
}

let sdkPromise: Promise<void> | null = null;
function carregarSdk(): Promise<void> {
  if (typeof window !== "undefined" && window.PagSeguro) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("Falha ao carregar o PagBank."));
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

// Endereço de cobrança p/ o 3DS (billingAddress). Region code = UF.
export type PagBankBilling = {
  street: string;
  number: string;
  complement?: string | null;
  city: string;
  regionCode: string; // UF
  postalCode: string; // só dígitos
};
export type PagBankCustomer = {
  nome: string;
  email: string;
  cpf: string; // só dígitos
  telefone: string; // só dígitos
};

const inputBase =
  "w-full min-h-11 px-3 rounded-lg border bg-white text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 border-border focus:border-primary focus:ring-primary/30 transition-all";
const labelCls = "block text-xs font-medium text-primary mb-1";

function fmtNumero(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 19);
  return d.replace(/(.{4})/g, "$1 ").trim();
}
function fmtValidade(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/**
 * Formulário de cartão do PagBank. Criptografa o cartão NO NAVEGADOR com a chave
 * pública (nunca PAN/CVV ao nosso backend) e, quando possível, roda o 3-D Secure
 * antes de submeter. Só chama onPagar após o 3DS concluir (AUTH_FLOW_COMPLETED) —
 * ou sem 3DS quando o cartão não é elegível (AUTH_NOT_SUPPORTED). Desafio pendente
 * NUNCA vira pagamento.
 */
export default function PagBankCardForm({
  publicKey,
  sdkEnv,
  amount,
  maxInstallments,
  antesDePagar,
  onPagar,
  onErro,
}: {
  publicKey: string;
  sdkEnv: "PROD" | "SANDBOX";
  amount: number; // BRL
  maxInstallments: number;
  // Valida o checkout (campos + frete) e devolve os dados do comprador/endereço
  // ou lança com uma mensagem. Roda ANTES de cobrar (evita pedido órfão).
  antesDePagar: () => Promise<{
    customer: PagBankCustomer;
    billing: PagBankBilling | null;
  }>;
  onPagar: (cartao: CartaoPagbankInput) => Promise<void>;
  onErro?: (msg: string) => void;
}) {
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [validade, setValidade] = useState("");
  const [cvv, setCvv] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [processando, setProcessando] = useState(false);
  const sdkPronto = useRef(false);

  // Carrega o SDK sob demanda (a aba PagBank cartão só monta quando escolhida).
  useEffect(() => {
    let vivo = true;
    carregarSdk()
      .then(() => {
        if (vivo) sdkPronto.current = true;
      })
      .catch((e) => onErro?.(e instanceof Error ? e.message : "Falha ao carregar o PagBank."));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pagar() {
    if (processando) return;
    onErro?.("");

    // 1) Valida o checkout no pai (campos + frete). Lança em erro.
    let dados: { customer: PagBankCustomer; billing: PagBankBilling | null };
    try {
      dados = await antesDePagar();
    } catch (e) {
      onErro?.(e instanceof Error ? e.message : "Revise os campos.");
      return;
    }

    const digitos = numero.replace(/\D/g, "");
    const [mm, yy] = validade.split("/");
    if (digitos.length < 13 || !nome.trim() || !mm || !yy || cvv.length < 3) {
      onErro?.("Confira os dados do cartão.");
      return;
    }
    const expYear = yy.length === 2 ? `20${yy}` : yy;

    setProcessando(true);
    try {
      await carregarSdk();
      const sdk = window.PagSeguro;
      if (!sdk) throw new Error("PagBank indisponível. Tente novamente.");

      // 2) Criptografa o cartão no navegador (nunca envia PAN/CVV ao backend).
      const enc = sdk.encryptCard({
        publicKey,
        holder: nome.trim(),
        number: digitos,
        expMonth: mm,
        expYear,
        securityCode: cvv,
      });
      if (enc.hasErrors || !enc.encryptedCard) {
        throw new Error(
          enc.errors?.[0]?.message ?? "Não foi possível validar o cartão.",
        );
      }

      // 3) 3DS: cria a sessão e autentica no navegador. Se a sessão falhar
      //    (infra), segue sem 3DS (o motor do PagBank ainda decide). Se o cartão
      //    não for elegível (AUTH_NOT_SUPPORTED), segue sem 3DS. Desafio não
      //    concluído / troca de método → aborta (não cobra).
      let threeDsId: string | null = null;
      const sessao = await criar3dsSessionPagbank();
      if (sessao.ok) {
        sdk.setUp({ session: sessao.session, env: sdkEnv });
        const phone = {
          country: "55",
          area: dados.customer.telefone.slice(0, 2),
          number: dados.customer.telefone.slice(2),
          type: "MOBILE",
        };
        const auth = await sdk.authenticate3DS({
          data: {
            customer: {
              name: dados.customer.nome,
              email: dados.customer.email,
              phones: dados.customer.telefone.length >= 10 ? [phone] : [],
            },
            paymentMethod: {
              type: "CREDIT_CARD",
              installments: parcelas,
              card: { encrypted: enc.encryptedCard },
            },
            amount: { value: Math.round(amount * 100), currency: "BRL" },
            ...(dados.billing
              ? {
                  billingAddress: {
                    street: dados.billing.street,
                    number: dados.billing.number,
                    complement: dados.billing.complement ?? "",
                    city: dados.billing.city,
                    regionCode: dados.billing.regionCode,
                    country: "BRA",
                    postalCode: dados.billing.postalCode,
                  },
                }
              : {}),
            dataOnly: false,
          },
        });

        if (auth.status === "AUTH_FLOW_COMPLETED" && auth.id) {
          threeDsId = auth.id;
        } else if (auth.status === "AUTH_NOT_SUPPORTED") {
          threeDsId = null; // cartão não elegível → cobra sem 3DS
        } else {
          // CHANGE_PAYMENT_METHOD, REQUIRE_CHALLENGE não concluído, etc.
          throw new Error(
            "Não foi possível autenticar o cartão. Use outro cartão ou pague com Pix.",
          );
        }
      }

      // 4) Cobra (o pai cria o pedido + chama a action). Pode redirecionar.
      await onPagar({
        cartaoCriptografado: enc.encryptedCard,
        holderNome: nome.trim(),
        installments: parcelas,
        threeDsId,
      });
    } catch (e) {
      onErro?.(
        e instanceof Error ? e.message : "Não foi possível processar o cartão.",
      );
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls} htmlFor="pb-numero">
          Número do cartão
        </label>
        <input
          id="pb-numero"
          inputMode="numeric"
          autoComplete="cc-number"
          className={inputBase}
          placeholder="0000 0000 0000 0000"
          value={numero}
          onChange={(e) => setNumero(fmtNumero(e.target.value))}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="pb-nome">
          Nome impresso no cartão
        </label>
        <input
          id="pb-nome"
          autoComplete="cc-name"
          className={inputBase}
          value={nome}
          onChange={(e) => setNome(e.target.value.toUpperCase())}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="pb-validade">
            Validade (MM/AA)
          </label>
          <input
            id="pb-validade"
            inputMode="numeric"
            autoComplete="cc-exp"
            className={inputBase}
            placeholder="MM/AA"
            value={validade}
            onChange={(e) => setValidade(fmtValidade(e.target.value))}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="pb-cvv">
            CVV
          </label>
          <input
            id="pb-cvv"
            inputMode="numeric"
            autoComplete="cc-csc"
            className={inputBase}
            placeholder="123"
            value={cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="pb-parcelas">
          Parcelas
        </label>
        <select
          id="pb-parcelas"
          className={inputBase}
          value={parcelas}
          onChange={(e) => setParcelas(Number(e.target.value))}
        >
          {Array.from({ length: Math.max(1, maxInstallments) }, (_, i) => i + 1).map(
            (n) => (
              <option key={n} value={n}>
                {n}x de {formatBRL(amount / n)}
                {n === 1 ? " à vista" : ` (total ${formatBRL(amount)})`}
              </option>
            ),
          )}
        </select>
      </div>

      <button
        type="button"
        onClick={pagar}
        disabled={processando}
        className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-white text-sm font-semibold py-3 rounded-pill hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      >
        {processando ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <Lock size={15} aria-hidden="true" />
        )}
        {processando ? "Processando…" : `Pagar ${formatBRL(amount)}`}
      </button>
      <p className="text-[11px] text-muted-foreground text-center leading-snug">
        Pagamento processado com segurança pelo PagBank. Seus dados do cartão são
        criptografados no seu navegador.
      </p>
    </div>
  );
}
