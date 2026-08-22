"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { formatBRL } from "@/lib/utils/format";
import {
  consultarStatusPedido,
  gerarNovoPix,
  type CheckoutPixData,
} from "@/actions/checkout";

const POLL_MS = 4500;

function restanteSegundos(expiraEm: string | null): number {
  if (!expiraEm) return 0;
  const ms = new Date(expiraEm).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

// Acima de 1h o mm:ss vira "1439:12" e não diz nada — nessa faixa o cliente só
// quer saber que tem folga, então mostramos em horas.
function mmss(seg: number): string {
  if (seg >= 3600) {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  }
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PixPanel({ pix: pixInicial }: { pix: CheckoutPixData }) {
  const router = useRouter();
  const [pix, setPix] = useState<CheckoutPixData>(pixInicial);
  const [restante, setRestante] = useState(() =>
    restanteSegundos(pixInicial.expiraEm),
  );
  const [copiado, setCopiado] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const redirecionando = useRef(false);

  const numero = pix.numero;
  const expirado = restante <= 0 && !!pix.expiraEm;

  // Contagem regressiva (tick de 1s).
  useEffect(() => {
    const id = setInterval(() => {
      setRestante(restanteSegundos(pix.expiraEm));
    }, 1000);
    return () => clearInterval(id);
  }, [pix.expiraEm, pix.token]);

  // Poll do status no banco; ao confirmar PAGO → vai pra página de sucesso.
  useEffect(() => {
    let ativo = true;
    const id = setInterval(async () => {
      if (redirecionando.current) return;
      try {
        const res = await consultarStatusPedido(numero);
        if (ativo && res?.pago) {
          redirecionando.current = true;
          clearInterval(id);
          // numero "#2026-0001" → rota limpa "/pedido/2026-0001/sucesso".
          router.push(`/pedido/${numero.replace(/^#/, "")}/sucesso${pix.token ? `?t=${pix.token}` : ""}`);
        }
      } catch {
        // rede instável — tenta de novo no próximo tick
      }
    }, POLL_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [numero, router, pix.token]);

  const copiar = useCallback(async () => {
    if (!pix.copiaECola) return;
    try {
      await navigator.clipboard.writeText(pix.copiaECola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não deu para copiar. Selecione o código manualmente.");
    }
  }, [pix.copiaECola]);

  const novoPix = useCallback(async () => {
    setRegenerando(true);
    setErro(null);
    try {
      const res = await gerarNovoPix(numero);
      if (res.ok) {
        setPix(res.data);
        setRestante(restanteSegundos(res.data.expiraEm));
      } else {
        setErro(res.error);
      }
    } finally {
      setRegenerando(false);
    }
  }, [numero]);

  return (
    <div className="container-site py-12 max-w-md mx-auto text-center space-y-5">
      <h1 className="text-primary text-2xl font-semibold">
        Pague com Pix para confirmar
      </h1>
      <p className="text-sm text-muted-foreground">
        Pedido <strong className="text-primary">{numero}</strong> ·{" "}
        <span className="text-green-600 font-semibold">
          {formatBRL(pix.valor)}
        </span>
      </p>

      {!expirado ? (
        <>
          {pix.qrCodeBase64 || pix.qrPngUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={
                pix.qrCodeBase64
                  ? `data:image/png;base64,${pix.qrCodeBase64}`
                  : (pix.qrPngUrl as string)
              }
              alt="QR Code do Pix"
              className="mx-auto w-60 h-60 rounded-lg border border-border bg-white"
              width={240}
              height={240}
            />
          ) : (
            <p className="text-sm text-amber-700">
              O QR não carregou. Use o código copia-e-cola abaixo.
            </p>
          )}

          {pix.copiaECola && (
            <div className="space-y-2 text-left">
              <span className="block text-xs font-medium text-primary">
                Pix copia-e-cola
              </span>
              <code className="block break-all rounded-lg border border-border bg-bg-alt p-3 text-xs text-primary">
                {pix.copiaECola}
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
                    <Copy size={16} aria-hidden="true" /> Copiar código
                  </>
                )}
              </button>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={15} className="animate-spin text-primary" aria-hidden="true" />
            Aguardando pagamento
            {pix.expiraEm ? (
              <span className="tabular-nums">· expira em {mmss(restante)}</span>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground leading-snug">
            Pague pelo app do seu banco lendo o QR ou colando o código. A
            confirmação é automática, então não feche esta página.
          </p>
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-amber-800 bg-amber-50 rounded-lg p-3">
            Este Pix expirou. Gere um novo código para concluir o pagamento do
            pedido {numero}.
          </p>
          <button
            type="button"
            onClick={novoPix}
            disabled={regenerando}
            className="w-full inline-flex items-center justify-center gap-2 bg-secondary text-white text-sm font-semibold py-3 rounded-pill hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {regenerando ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={16} aria-hidden="true" />
            )}
            {regenerando ? "Gerando…" : "Gerar novo Pix"}
          </button>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-xs text-red-700 bg-red-50 rounded-md p-2">
          {erro}
        </p>
      )}
    </div>
  );
}
