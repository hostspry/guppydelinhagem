"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Roleta, type Fatia, type ResultadoApresentado } from "./Roleta";

/**
 * Roleta da página pública. Enquanto o sorteio está homologado e sem
 * resultado, consulta o estado a cada poucos segundos; quando o resultado
 * aparece, gira sozinha até ele. Quem chega depois vê a roleta parada no
 * vencedor e pode rever a animação.
 */
export function RoletaPublica({
  slug,
  fatias,
  total,
  premio,
  imagemUrl,
  statusInicial,
  resultadoInicial,
}: {
  slug: string;
  fatias: Fatia[];
  total: number;
  premio: string;
  imagemUrl: string | null;
  statusInicial: string;
  resultadoInicial: ResultadoApresentado | null;
}) {
  const [resultado, setResultado] = useState(resultadoInicial);
  const [apresentar, setApresentar] = useState<(ResultadoApresentado & { chave: number }) | null>(null);
  const [aguardando, setAguardando] = useState(statusInicial === "HOMOLOGADO" && !resultadoInicial);

  useEffect(() => {
    if (!aguardando) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/sorteios/${slug}/estado`, { cache: "no-store" });
        if (!r.ok) return;
        const e = (await r.json()) as { resultado: ResultadoApresentado | null };
        if (e.resultado) {
          setAguardando(false);
          setResultado(e.resultado);
          setApresentar({ ...e.resultado, chave: Date.now() });
        }
      } catch {
        // rede instável: tenta no próximo ciclo
      }
    }, 4000);
    return () => clearInterval(t);
  }, [aguardando, slug]);

  return (
    <Roleta
      fatias={fatias}
      total={total}
      premio={premio}
      imagemUrl={imagemUrl}
      resultadoInicial={resultadoInicial}
      apresentar={apresentar}
      rodape={
        <div className="space-y-2">
          {aguardando && (
            <p className="flex items-center gap-2 rounded-lg bg-white/10 p-3 text-sm text-white/80">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#FF035C]" />
              Aguardando o sorteio. A roleta gira sozinha quando o resultado sair.
            </p>
          )}
          {resultado && (
            <button type="button" onClick={() => setApresentar({ ...resultado, chave: Date.now() })} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm ring-1 ring-white/25 hover:bg-white/20">
              <RotateCcw className="h-4 w-4" /> Rever animação
            </button>
          )}
        </div>
      }
    />
  );
}
