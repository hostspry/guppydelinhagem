"use client";

import { useState } from "react";
import { PartyPopper, X } from "lucide-react";
import { dispensarAvisoAction } from "@/actions/sorteios-cliente";

/** "Parabéns! Identificamos N chances…" — aparece uma vez, depois do vínculo. */
export function AvisoCreditos({ avisos }: { avisos: { participanteId: string; chances: number; sorteio: string }[] }) {
  const [visivel, setVisivel] = useState(true);
  if (!visivel || avisos.length === 0) return null;
  return (
    <div role="status" className="relative rounded-2xl bg-gradient-to-br from-[#FF035C] to-[#87002F] p-5 pr-12 text-white shadow-lg">
      <PartyPopper className="mb-2 h-7 w-7 text-[#FAB82A]" aria-hidden="true" />
      {avisos.map((a) => (
        <p key={a.participanteId} className="text-lg font-semibold leading-snug">
          Parabéns! Identificamos {a.chances} {a.chances === 1 ? "chance" : "chances"} no {a.sorteio} vinculadas ao seu WhatsApp.
        </p>
      ))}
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => {
          setVisivel(false);
          void dispensarAvisoAction(avisos.map((a) => a.participanteId));
        }}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/25"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
