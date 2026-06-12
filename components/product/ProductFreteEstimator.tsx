"use client";

import { useState } from "react";
import { AlertTriangle, Clock, Loader2, MapPin, Truck } from "lucide-react";
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

function formatEndereco(e: Endereco): string {
  const ruaBairro = [e.rua, e.bairro].filter(Boolean).join(", ");
  const cidadeUf = [e.cidade, e.uf].filter(Boolean).join("/");
  return [ruaBairro, cidadeUf].filter(Boolean).join(" — ");
}

export default function ProductFreteEstimator({ qtd }: { qtd: number }) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreteResponse | null>(null);

  const cepDigits = cep.replace(/\D/g, "");
  const cepValido = /^\d{8}$/.test(cepDigits);
  const excedeCaixa = qtd > MAX_PEIXES_POR_CAIXA;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cepValido || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/frete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cepDestino: cepDigits, qtd }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error ?? "Erro ao calcular frete.");
      else setResult(data);
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Truck size={18} className="text-primary" aria-hidden="true" />
        <h2 className="text-primary font-semibold">Estimativa de frete</h2>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2" noValidate>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Seu CEP (00000-000)"
          value={cep}
          onChange={(e) => setCep(formatCep(e.target.value))}
          maxLength={9}
          className="flex-1 min-h-11 px-4 rounded-lg border border-border bg-white text-base text-primary placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <button
          type="submit"
          disabled={!cepValido || loading}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-pill bg-secondary text-white font-semibold text-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Calculando…
            </>
          ) : (
            "Calcular frete"
          )}
        </button>
      </form>

      <div aria-live="polite" className="space-y-3 empty:hidden">
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {result && (
          <>
            {result.endereco && formatEndereco(result.endereco) && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground leading-snug">
                <MapPin size={15} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  <span className="font-medium">Entrega para:</span>{" "}
                  {formatEndereco(result.endereco)}
                </span>
              </p>
            )}

            {result.jadlog.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Para sua região, o envio é feito via Gollog.
              </p>
            )}

            {result.jadlog.map((opt) => (
              <div key={opt.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Clock size={15} aria-hidden="true" />
                    {opt.name} · {opt.deliveryTime} dias úteis
                  </span>
                  <span className="font-bold text-primary shrink-0">
                    {formatBRL(opt.price)}
                  </span>
                </div>
                {opt.requerAvaliacao && (
                  <p className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-md p-2 leading-snug">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                    Esse prazo ({opt.deliveryTime} dias úteis) exige avaliação prévia
                    da idade dos peixes — confirme no WhatsApp ao fechar.
                  </p>
                )}
              </div>
            ))}

            <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <Clock size={15} aria-hidden="true" />
                Gollog (aéreo) · 1-2 dias úteis
              </span>
              <span className="font-bold text-primary shrink-0">
                {formatBRL(result.gollog.min)}–{formatBRL(result.gollog.max)}
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-snug">
              Estimativa para {qtd} peixe{qtd > 1 ? "s" : ""}. O valor final do
              pedido completo é calculado no checkout (vários peixes vão na mesma
              caixa).
            </p>

            {excedeCaixa && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-md p-2 leading-snug">
                Para mais de {MAX_PEIXES_POR_CAIXA} peixes, o frete precisa ser
                recalculado.{" "}
                <a
                  href={whatsappLink(
                    `Olá! Tenho ${qtd} peixes e gostaria de recalcular o frete para fechar o pedido.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold underline hover:text-amber-900"
                >
                  <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                  Falar no WhatsApp
                </a>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
