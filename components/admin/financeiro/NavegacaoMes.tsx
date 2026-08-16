import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  competenciaAnterior,
  competenciaAtual,
  competenciaSeguinte,
  rotuloCompetencia,
} from "@/lib/financeiro/periodo";

/** Setas de mês. Links de verdade (não botões) para o mês entrar no histórico. */
export function NavegacaoMes({ competencia }: { competencia: string }) {
  const hoje = competenciaAtual();

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/admin/financeiro?mes=${competenciaAnterior(competencia)}`}
        className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-[#07366A] hover:border-gray-300"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </Link>

      <span className="px-3 text-sm font-medium text-[#07366A] capitalize min-w-[10rem] text-center">
        {rotuloCompetencia(competencia)}
      </span>

      <Link
        href={`/admin/financeiro?mes=${competenciaSeguinte(competencia)}`}
        className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:text-[#07366A] hover:border-gray-300"
        aria-label="Próximo mês"
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </Link>

      {competencia !== hoje && (
        <Link
          href="/admin/financeiro"
          className="ml-2 text-xs text-[#FF035C] hover:underline"
        >
          voltar para o mês atual
        </Link>
      )}
    </div>
  );
}
