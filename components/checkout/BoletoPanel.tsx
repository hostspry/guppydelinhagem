"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Check, Copy, Download, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/utils/format";
import {
  consultarStatusPedido,
  type CheckoutBoletoData,
} from "@/actions/checkout";

const POLL_MS = 8000;

export default function BoletoPanel({ boleto }: { boleto: CheckoutBoletoData }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const redirecionando = useRef(false);
  const numero = boleto.numero;

  // Poll do status no banco; ao compensar (webhook → PAGO) vai pra sucesso. O
  // boleto compensa em 1–3 dias úteis, mas o poll cobre o caso de pagar na hora.
  useEffect(() => {
    let ativo = true;
    const id = setInterval(async () => {
      if (redirecionando.current) return;
      try {
        const res = await consultarStatusPedido(numero);
        if (ativo && res?.pago) {
          redirecionando.current = true;
          clearInterval(id);
          router.push(`/pedido/${numero.replace(/^#/, "")}/sucesso`);
        }
      } catch {
        // rede instável — tenta de novo no próximo tick
      }
    }, POLL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [numero, router]);

  const linha = boleto.linhaDigitavel ?? boleto.codigoBarras;
  const copiar = useCallback(async () => {
    if (!linha) return;
    try {
      await navigator.clipboard.writeText(linha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não deu para copiar. Selecione o código manualmente.");
    }
  }, [linha]);

  return (
    <div className="container-site py-12 max-w-md mx-auto text-center space-y-5">
      <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 flex items-center justify-center">
        <Barcode className="w-7 h-7 text-amber-700" aria-hidden="true" />
      </div>
      <h1 className="text-primary text-2xl font-semibold">
        Boleto gerado
      </h1>
      <p className="text-sm text-muted-foreground">
        Pedido <strong className="text-primary">{numero}</strong> ·{" "}
        <span className="text-primary font-semibold">{formatBRL(boleto.valor)}</span>
      </p>

      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-snug">
        O pedido fica <strong>aguardando pagamento</strong> até o boleto
        compensar (normalmente 1 a 3 dias úteis). Assim que confirmar, você recebe
        a atualização e o pedido segue.
      </p>

      {linha && (
        <div className="space-y-2 text-left">
          <span className="block text-xs font-medium text-primary">
            Linha digitável
          </span>
          <code className="block break-all rounded-lg border border-border bg-bg-alt p-3 text-xs text-primary">
            {linha}
          </code>
          <button
            type="button"
            onClick={copiar}
            className="w-full inline-flex items-center justify-center gap-2 min-h-11 rounded-pill border border-border text-primary font-medium text-sm hover:border-primary transition-all"
          >
            {copiado ? (
              <>
                <Check size={16} aria-hidden="true" /> Código copiado
              </>
            ) : (
              <>
                <Copy size={16} aria-hidden="true" /> Copiar linha digitável
              </>
            )}
          </button>
        </div>
      )}

      {boleto.linkPdf && (
        <a
          href={boleto.linkPdf}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-white text-sm font-semibold py-3 rounded-pill hover:brightness-110 transition-all"
        >
          <Download size={16} aria-hidden="true" />
          Abrir boleto (PDF)
        </a>
      )}

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
        Aguardando compensação
      </div>

      {erro && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-md p-2">
          {erro}
        </p>
      )}
    </div>
  );
}
