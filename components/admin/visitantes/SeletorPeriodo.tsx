"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PERIODOS, type Periodo } from "@/lib/rastreio/periodo";

/**
 * Janela de tempo da página inteira.
 *
 * Links de verdade, e não estado local: assim cada janela tem endereço próprio,
 * entra no histórico do navegador e pode ser mandada para outra pessoa. É o
 * mesmo raciocínio das abas de Configurações.
 *
 * Fica numa linha só, acima de tudo, e vale para todos os blocos abaixo — não
 * existe filtro por gráfico, senão dois números da mesma tela passariam a falar
 * de períodos diferentes.
 */
export function SeletorPeriodo({ atual }: { atual: Periodo }) {
  const pathname = usePathname();
  const params = useSearchParams();

  function href(p: Periodo) {
    const q = new URLSearchParams(params.toString());
    q.set("periodo", p);
    // Trocar de janela recomeça a paginação: página 7 de outro período não é a
    // mesma lista, e cair numa página vazia parece defeito.
    q.delete("p");
    return `${pathname}?${q.toString()}`;
  }

  return (
    <nav aria-label="Período da análise" className="flex flex-wrap items-center gap-1.5">
      {PERIODOS.map((p) => {
        const ativo = p.valor === atual;
        return (
          <Link
            key={p.valor}
            href={href(p.valor)}
            scroll={false}
            aria-current={ativo ? "page" : undefined}
            className={`inline-flex items-baseline gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              ativo
                ? "border-[#07366A] bg-[#07366A] text-white"
                : "border-gray-300 bg-white text-gray-600 hover:border-[#07366A] hover:text-[#07366A]"
            }`}
          >
            {p.rotulo}
            <span className={`text-[11px] ${ativo ? "text-white/60" : "text-gray-400"}`}>
              {p.descricao}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
