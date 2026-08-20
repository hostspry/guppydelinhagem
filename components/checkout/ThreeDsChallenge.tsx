"use client";

import { useEffect, useRef } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

/**
 * Desafio 3DS 2.0 (autenticação do emissor).
 *
 * Quando o Mercado Pago considera a compra arriscada, em vez de recusar ele
 * devolve `status_detail: "pending_challenge"` e o banco pede uma confirmação ao
 * cliente (app, SMS, senha). O desafio roda dentro de um iframe nosso: fazemos um
 * POST do `creq` para a `external_resource_url` do emissor.
 *
 * Regras que vêm da doc do MP e não podem ser afrouxadas:
 *  - o POST tem que sair em até 30s depois do pagamento criado, senão é recusado;
 *  - o cliente tem ~5min para concluir;
 *  - o `message` com status COMPLETE só diz que a tela fechou — quem sabe o
 *    desfecho é a API, então quem chama a gente consulta o pagamento depois.
 */
export default function ThreeDsChallenge({
  externalResourceUrl,
  creq,
  onConcluido,
}: {
  externalResourceUrl: string;
  creq: string;
  onConcluido: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const jaConcluiu = useRef(false);

  useEffect(() => {
    const concluir = () => {
      if (jaConcluiu.current) return;
      jaConcluiu.current = true;
      onConcluido();
    };

    // O emissor avisa o fim do desafio por postMessage.
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { status?: string } | string | null;
      const status = typeof d === "string" ? d : d?.status;
      if (status === "COMPLETE") concluir();
    };
    window.addEventListener("message", onMessage);

    // Rede de segurança: se o aviso não vier (emissor que não posta a mensagem,
    // cliente que abandonou), consultamos assim mesmo depois da janela do banco.
    const limite = setTimeout(concluir, 6 * 60 * 1000);

    // Dispara o POST imediatamente — os 30s do MP correm desde a criação.
    formRef.current?.submit();

    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(limite);
    };
  }, [onConcluido]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-[540px] rounded-lg bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <ShieldCheck className="h-5 w-5 text-[#07366A]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#07366A]">
              Seu banco pediu uma confirmação
            </p>
            <p className="text-xs text-gray-500">
              Conclua aqui para aprovar a compra. Não feche esta janela.
            </p>
          </div>
        </div>

        <div className="relative bg-white">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2
              className="h-6 w-6 animate-spin text-gray-300"
              aria-hidden="true"
            />
          </div>
          {/* O iframe recebe o POST; o form fica fora dele com target. */}
          <iframe
            name="mp3dsFrame"
            title="Confirmação do banco"
            className="relative h-[440px] w-full border-0 sm:h-[600px]"
          />
          <form
            ref={formRef}
            method="post"
            action={externalResourceUrl}
            target="mp3dsFrame"
            className="hidden"
          >
            <input type="hidden" name="creq" value={creq} readOnly />
          </form>
        </div>
      </div>
    </div>
  );
}
