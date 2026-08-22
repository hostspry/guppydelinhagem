"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from "lucide-react";
import {
  alternarHeroSlide,
  excluirHeroSlide,
  moverHeroSlide,
} from "@/actions/hero";

/**
 * Ligar/desligar, reordenar e apagar um slide.
 *
 * As regras que impedem a home de ficar sem topo (não apagar o único, não
 * desligar o último ligado) vivem no servidor; aqui só mostramos a resposta.
 */
export function HeroSlideAcoes({
  id,
  ativo,
  titulo,
  primeiro,
  ultimo,
}: {
  id: string;
  ativo: boolean;
  titulo: string;
  primeiro: boolean;
  ultimo: boolean;
}) {
  const [pendente, start] = useTransition();
  const router = useRouter();

  function alternar() {
    start(async () => {
      const r = await alternarHeroSlide(id);
      if (r.success) {
        toast.success(r.message ?? "Pronto.");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function mover(direcao: "cima" | "baixo") {
    start(async () => {
      const r = await moverHeroSlide(id, direcao);
      if (r.success) router.refresh();
      else toast.error(r.error);
    });
  }

  function apagar() {
    if (!confirm(`Apagar o slide "${titulo}"? Isso não tem volta.`)) return;
    start(async () => {
      const r = await excluirHeroSlide(id);
      if (r.success) {
        toast.success(r.message ?? "Slide apagado.");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  const botao =
    "p-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-[#07366A] hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => mover("cima")}
        disabled={pendente || primeiro}
        aria-label="Subir"
        className={botao}
      >
        <ArrowUp className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => mover("baixo")}
        disabled={pendente || ultimo}
        aria-label="Descer"
        className={botao}
      >
        <ArrowDown className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={alternar}
        disabled={pendente}
        aria-label={ativo ? "Desligar" : "Ligar"}
        title={ativo ? "Desligar" : "Ligar"}
        className={botao}
      >
        {ativo ? (
          <Eye className="w-4 h-4" aria-hidden="true" />
        ) : (
          <EyeOff className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={apagar}
        disabled={pendente}
        aria-label="Apagar"
        title="Apagar"
        className={`${botao} hover:text-[#FF035C] hover:border-[#FF035C]/40`}
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
