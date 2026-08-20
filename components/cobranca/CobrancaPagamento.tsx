"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, QrCode } from "lucide-react";
import CardPaymentBrick from "@/components/checkout/CardPaymentBrick";
import ThreeDsChallenge from "@/components/checkout/ThreeDsChallenge";
import { carregarDeviceMp } from "@/lib/mp-device";
import { pagarCobranca, pagarCobrancaCartao } from "@/actions/cobrancas";
import { finalizarDesafio3ds, type CartaoInput } from "@/actions/checkout";

/**
 * Pagamento do link de cobrança.
 *
 * Cartão roda AQUI (Card Payment Brick + nosso servidor), não no Checkout Pro: é
 * o único jeito de mandar o Device ID no header e pedir 3DS. Enquanto o cartão
 * passava pelo Checkout Pro, todo pagamento chegava ao antifraude sem
 * fingerprint e voltava cc_rejected_high_risk.
 *
 * O Pix continua no Checkout Pro (o mesmo botão de antes) — lá não há recusa por
 * risco, então não vale reescrever.
 */
export default function CobrancaPagamento({
  token,
  total,
  maxParcelas,
  mpPublicKey,
  clienteEmail,
}: {
  token: string;
  total: number;
  maxParcelas: number;
  mpPublicKey: string | null;
  clienteEmail: string | null;
}) {
  const router = useRouter();
  const [aba, setAba] = useState<"cartao" | "pix">("cartao");
  const [erro, setErro] = useState<string | null>(null);
  const [recusa, setRecusa] = useState<string | null>(null);
  const [abrindoPix, setAbrindoPix] = useState(false);
  const [desafio3ds, setDesafio3ds] = useState<{
    paymentId: string;
    externalResourceUrl: string;
    creq: string;
  } | null>(null);

  // Fingerprint começa a coletar na abertura da página, não no clique.
  useEffect(() => {
    carregarDeviceMp("checkout");
  }, []);

  function tratar(
    res: Awaited<ReturnType<typeof pagarCobrancaCartao>>,
  ): void {
    if (res.resultado === "aprovado" || res.resultado === "analise") {
      router.refresh(); // a própria página passa a mostrar "pagamento confirmado"
      return;
    }
    if (res.resultado === "desafio") {
      setDesafio3ds({
        paymentId: res.paymentId,
        externalResourceUrl: res.externalResourceUrl,
        creq: res.creq,
      });
      return;
    }
    if (res.resultado === "recusado") {
      setRecusa(res.mensagem);
      return;
    }
    setErro(res.mensagem);
  }

  async function onCartao(cartao: CartaoInput) {
    setErro(null);
    setRecusa(null);
    const res = await pagarCobrancaCartao(token, cartao);
    tratar(res);
    // O Brick espera um throw para reabilitar o formulário numa recusa.
    if (res.resultado === "recusado") throw new Error(res.mensagem);
    if (res.resultado === "erro") throw new Error(res.mensagem);
  }

  async function onFim3ds(paymentId: string) {
    const res = await finalizarDesafio3ds(paymentId);
    setDesafio3ds(null);
    if (res.resultado === "aprovado" || res.resultado === "analise") {
      router.refresh();
      return;
    }
    if (res.resultado === "recusado") {
      setRecusa(res.mensagem);
      return;
    }
    setErro(
      res.resultado === "erro"
        ? res.mensagem
        : "Não conseguimos confirmar o pagamento. Tente de novo.",
    );
  }

  function abrirPix() {
    setErro(null);
    setAbrindoPix(true);
    pagarCobranca(token)
      .then((r) => {
        if (r.ok) window.location.href = r.initPoint;
        else {
          setErro(r.error);
          setAbrindoPix(false);
        }
      })
      .catch(() => {
        setErro("Não foi possível abrir o Pix agora.");
        setAbrindoPix(false);
      });
  }

  const abaCls = (ativa: boolean) =>
    `inline-flex flex-1 items-center justify-center gap-1.5 py-2 rounded-md text-sm font-semibold transition-all ${
      ativa
        ? "bg-white text-[#07366A] shadow-sm"
        : "text-gray-500 hover:text-[#07366A]"
    }`;

  return (
    <div>
      {desafio3ds && (
        <ThreeDsChallenge
          externalResourceUrl={desafio3ds.externalResourceUrl}
          creq={desafio3ds.creq}
          onConcluido={() => onFim3ds(desafio3ds.paymentId)}
        />
      )}

      <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg mb-4">
        <button type="button" onClick={() => setAba("cartao")} className={abaCls(aba === "cartao")}>
          <CreditCard size={15} aria-hidden="true" />
          Cartão
        </button>
        <button type="button" onClick={() => setAba("pix")} className={abaCls(aba === "pix")}>
          <QrCode size={15} aria-hidden="true" />
          Pix
        </button>
      </div>

      {aba === "cartao" ? (
        mpPublicKey ? (
          <>
            <p className="text-[11px] text-gray-500 text-center mb-2">
              Em até {maxParcelas}x no cartão.
            </p>
            <CardPaymentBrick
              publicKey={mpPublicKey}
              amount={total}
              maxInstallments={maxParcelas}
              payerEmail={clienteEmail ?? undefined}
              onPagar={onCartao}
              onErro={(m) => setErro(m)}
            />
          </>
        ) : (
          <p className="text-xs text-amber-700">
            Cartão indisponível no momento. Use o Pix.
          </p>
        )
      ) : (
        <div>
          <button
            type="button"
            onClick={abrirPix}
            disabled={abrindoPix}
            className="w-full bg-[#FF035C] text-white font-semibold py-3.5 rounded-lg hover:brightness-110 transition-all disabled:opacity-60"
          >
            {abrindoPix ? "Abrindo Pix…" : "Pagar com Pix"}
          </button>
          <p className="text-xs text-gray-500 text-center mt-3">
            O Pix abre no ambiente do Mercado Pago e cai na hora.
          </p>
        </div>
      )}

      {recusa && (
        <p
          role="alert"
          className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2 mt-3"
        >
          {recusa}
        </p>
      )}
      {erro && (
        <p className="text-sm text-[#FF035C] text-center mt-3" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}
