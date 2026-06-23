"use client";

import { useState } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { entrarNaListaDeEspera } from "@/actions/waitlist";
import { isValidWhatsappBR } from "@/lib/utils/whatsapp";

function formatWhatsapp(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function WaitlistForm({ productId }: { productId: string }) {
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [feito, setFeito] = useState(false);
  const valido = isValidWhatsappBR(valor);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || loading) return;
    setLoading(true);
    try {
      const res = await entrarNaListaDeEspera(productId, valor);
      if (res.ok) {
        setFeito(true);
        toast.success(
          "Pronto! Avisaremos você no WhatsApp quando este peixe estiver disponível.",
        );
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (feito) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-start gap-2">
        <Check size={18} className="text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-green-800">
          Tudo certo! Você está na lista de espera. Assim que sair uma nova
          ninhada deste peixe, a gente te avisa no WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BellRing size={18} className="text-secondary" aria-hidden="true" />
        <h3 className="font-semibold text-primary">Avise-me quando disponível</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Sem estoque no momento. Deixe seu WhatsApp e avisamos quando houver nova
        ninhada.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2" noValidate>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="(27) 99999-9999"
          value={valor}
          onChange={(e) => setValor(formatWhatsapp(e.target.value))}
          maxLength={16}
          className="flex-1 min-h-11 px-4 rounded-lg border border-border bg-white text-base text-primary placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
        />
        <button
          type="submit"
          disabled={!valido || loading}
          className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-pill bg-secondary text-white font-semibold text-sm hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Enviando…
            </>
          ) : (
            "Quero ser avisado"
          )}
        </button>
      </form>
    </div>
  );
}
