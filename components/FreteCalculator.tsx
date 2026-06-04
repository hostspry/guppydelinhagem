"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_PHONE } from "@/lib/constants";

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
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Versão compacta sem centavos pra cards apertados no mobile
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function formatEndereco(end: Endereco): string {
  // Ordem: "rua, bairro — cidade/uf". Omite partes null.
  const ruaBairro = [end.rua, end.bairro].filter(Boolean).join(", ");
  const cidadeUf = [end.cidade, end.uf].filter(Boolean).join("/");
  if (!ruaBairro && !cidadeUf) return "";
  if (!ruaBairro) return cidadeUf;
  if (!cidadeUf) return ruaBairro;
  return `${ruaBairro} — ${cidadeUf}`;
}

export default function FreteCalculator() {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FreteResponse | null>(null);

  const cepDigits = cep.replace(/\D/g, "");
  const cepValido = /^\d{8}$/.test(cepDigits);

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
        body: JSON.stringify({ cepDestino: cepDigits }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Erro ao calcular frete.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const semJadlog = result && result.jadlog.length === 0;
  const algumPrazoLongo =
    result?.jadlog.some((j) => j.requerAvaliacao) ?? false;
  const gollogDestaque = semJadlog || algumPrazoLongo;

  const gollogMsg = `Olá! Quero confirmar o frete Gollog para o CEP ${cep || ""}`.trim();
  const gollogHref = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(gollogMsg)}`;

  function avaliarHref(deliveryTime: number) {
    const msg = `Olá! O frete terrestre para meu CEP ${cep} leva ${deliveryTime} dias. Quero avaliar as opções de envio.`;
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-sm border border-black/5 p-6 md:p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold text-primary">
          Calcule seu frete
        </h1>
        <p className="text-sm md:text-base text-[#555] leading-relaxed">
          Enviamos guppies para todo o Brasil com embalagem especializada.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <label htmlFor="cep" className="block text-sm font-medium text-primary">
          CEP de entrega
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="cep"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={cep}
            onChange={(e) => setCep(formatCep(e.target.value))}
            maxLength={9}
            className="flex-1 min-h-14 px-5 py-3 box-border rounded-xl border border-border bg-white text-lg font-medium leading-none text-primary placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <button
            type="submit"
            disabled={!cepValido || loading}
            className="inline-flex items-center justify-center gap-2 min-h-14 px-7 rounded-pill bg-secondary text-white font-semibold text-base shadow-[0_8px_24px_-8px_rgba(255,3,92,0.5)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                Calculando…
              </>
            ) : (
              "Calcular frete"
            )}
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {result.endereco &&
            (() => {
              const enderecoLinha = formatEndereco(result.endereco);
              return enderecoLinha ? (
                <p className="flex items-start gap-2 text-sm text-[#555] leading-snug">
                  <MapPin
                    size={16}
                    className="text-primary shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-medium">Entrega para:</span>{" "}
                    {enderecoLinha}
                  </span>
                </p>
              ) : null;
            })()}

          {semJadlog && (
            <p className="text-sm text-[#555]">
              Para sua região, o envio é feito via Gollog.
            </p>
          )}

          {result.jadlog.map((opt) => (
            <div
              key={opt.id}
              className="rounded-xl border border-black/10 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-primary">{opt.name}</span>
                  <p className="text-xs text-[#666] mt-0.5">
                    {opt.deliveryTime} dias úteis
                  </p>
                </div>
                <div className="text-lg font-bold text-primary shrink-0">
                  {brl.format(opt.price)}
                </div>
              </div>

              {opt.requerAvaliacao && (
                <>
                  <div className="flex items-start gap-3 rounded-lg bg-accent/10 border border-accent/30 p-3">
                    <AlertTriangle
                      size={18}
                      className="text-accent shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-[#444] leading-relaxed">
                      O envio terrestre para sua região leva{" "}
                      <strong>{opt.deliveryTime} dias úteis</strong>. Para a
                      segurança dos peixes, esse prazo exige uma avaliação
                      prévia da idade dos animais.
                    </p>
                  </div>
                  <a
                    href={avaliarHref(opt.deliveryTime)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-11 px-5 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all"
                  >
                    <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                    Avaliar envio no WhatsApp
                  </a>
                </>
              )}
            </div>
          ))}

          <div
            className={`rounded-xl overflow-hidden p-4 space-y-3 ${
              gollogDestaque
                ? "border-2 border-accent bg-accent/5"
                : "border border-black/10"
            }`}
          >
            {gollogDestaque && (
              <span className="inline-block text-[10px] uppercase tracking-wider font-bold text-[#302f2f] bg-accent px-2 py-0.5 rounded-full">
                Recomendado para sua região
              </span>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-primary">
                  Gollog (envio aéreo)
                </p>
                <p className="text-xs text-[#666] mt-0.5">
                  Valor confirmado no fechamento do pedido — retirada no
                  aeroporto mais próximo
                </p>
              </div>
              <div className="text-lg font-bold text-primary sm:text-right sm:shrink-0">
                {/* Mobile: compacto sem centavos; sm:+ valor completo */}
                <span className="sm:hidden">
                  {brlCompact.format(result.gollog.min)} –{" "}
                  {brlCompact.format(result.gollog.max)}
                </span>
                <span className="hidden sm:inline">
                  {brl.format(result.gollog.min)} a{" "}
                  {brl.format(result.gollog.max)}
                </span>
              </div>
            </div>
            {gollogDestaque && (
              <p className="text-sm text-[#555] leading-relaxed">
                O envio aéreo chega em 1-2 dias. Muitos criadores retiram no
                aeroporto do seu estado — prática comum no hobby.
              </p>
            )}
            <a
              href={gollogHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-h-11 px-5 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all"
            >
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
              Confirmar valor no WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
