"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock, Loader2, MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { formatBRL } from "@/lib/utils/format";
import { whatsappLink, MAX_PEIXES_POR_CAIXA } from "@/lib/constants";

type JadlogOpt = {
  id: number;
  name: string;
  price: number;
  deliveryTime: number;
  requerAvaliacao: boolean;
};
type Endereco = {
  rua: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};
type FreteResponse = {
  endereco: Endereco | null;
  jadlog: JadlogOpt[];
  gollog: { min: number; max: number };
  maxPeixesPorCaixa: number;
};

function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export default function ProductFreteEstimator({ qtd }: { qtd: number }) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreteResponse | null>(null);

  const cepDigits = cep.replace(/\D/g, "");
  const cepValido = /^\d{8}$/.test(cepDigits);
  const excedeCaixa = qtd > MAX_PEIXES_POR_CAIXA;
  // Evita recalcular o mesmo (cep, qtd) — o cálculo automático dispara só quando
  // o par muda. O botão força via "" no ref.
  const ultimaChave = useRef("");

  const calcular = useCallback(async () => {
    if (!cepValido || loading) return;
    ultimaChave.current = `${cepDigits}|${qtd}`;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/frete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cepDestino: cepDigits, qtd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Erro ao calcular frete.");
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setError("Falha de rede. Tente novamente.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [cepDigits, qtd, cepValido, loading]);

  // Cálculo automático ao completar o CEP (8 dígitos) e quando a qtd muda.
  useEffect(() => {
    if (!cepValido) return;
    if (ultimaChave.current === `${cepDigits}|${qtd}`) return;
    calcular();
  }, [cepValido, cepDigits, qtd, calcular]);

  const cidadeUf =
    result?.endereco && (result.endereco.cidade || result.endereco.uf)
      ? [result.endereco.cidade, result.endereco.uf].filter(Boolean).join(" - ")
      : null;

  return (
    <div className="space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ultimaChave.current = ""; // força recálculo
          calcular();
        }}
        className="flex gap-2"
        noValidate
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Calcular frete: seu CEP"
          aria-label="CEP para calcular o frete"
          value={cep}
          onChange={(e) => setCep(formatCep(e.target.value))}
          maxLength={9}
          className="flex-1 min-h-11 px-3 rounded-lg border border-border bg-white text-sm text-primary placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <button
          type="submit"
          disabled={!cepValido || loading}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-lg border border-border text-primary font-medium text-sm hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            "Calcular"
          )}
        </button>
      </form>

      <div aria-live="polite" className="space-y-2 empty:hidden">
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}

        {result && (
          <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
            {cidadeUf && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin size={13} className="text-primary shrink-0" aria-hidden="true" />
                Frete para {cidadeUf}
              </p>
            )}

            {result.jadlog.map((opt) => (
              <div key={opt.id} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-primary">
                    <Clock size={14} aria-hidden="true" />
                    {opt.name} · {opt.deliveryTime} dias úteis
                  </span>
                  <span className="font-bold text-primary shrink-0">
                    {formatBRL(opt.price)}
                  </span>
                </div>
                {opt.requerAvaliacao && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700">
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
                    Prazo longo ({opt.deliveryTime} dias). Confirme a avaliação no
                    WhatsApp ao fechar.
                  </p>
                )}
              </div>
            ))}

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-primary">
                <Clock size={14} aria-hidden="true" />
                Gollog (aéreo) · 1-2 dias
              </span>
              <span className="font-bold text-primary shrink-0">
                {formatBRL(result.gollog.min)}–{formatBRL(result.gollog.max)}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-snug">
              Estimativa para {qtd} peixe{qtd > 1 ? "s" : ""}. O frete final do pedido
              completo sai no checkout (vários peixes vão na mesma caixa).
            </p>

            {excedeCaixa && (
              <p className="text-[11px] text-amber-700 leading-snug">
                Mais de {MAX_PEIXES_POR_CAIXA} peixes: a gente recalcula o frete.{" "}
                <a
                  href={whatsappLink(
                    `Olá! Tenho ${qtd} peixes e gostaria de recalcular o frete para fechar o pedido.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold underline hover:text-amber-900"
                >
                  <WhatsAppIcon className="w-3 h-3 text-[#25D366]" />
                  WhatsApp
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
