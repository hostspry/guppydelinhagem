import Link from "next/link";
import { Clock, Monitor, Search, Smartphone, Tablet } from "lucide-react";
import { EVENTO_LABEL } from "@/lib/rastreio/eventos";
import type { HistoricoVisitante } from "@/lib/rastreio/identificar";

/**
 * O que este cliente andou olhando no site.
 *
 * Serve para uma conversa concreta: "vi que você abriu o Full Red umas vezes,
 * chegou uma ninhada nova" vale mais que qualquer disparo para a lista inteira.
 *
 * Aparece só quando existe navegação ligada a ele. Cliente que só comprou pelo
 * WhatsApp e nunca abriu o site não ganha um cartão vazio dizendo "nada aqui".
 */

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const ORIGEM: Record<string, string> = {
  pedido: "quando fechou um pedido no site",
  cadastro: "quando preencheu o link de dados",
  login: "quando entrou na conta",
};

const ICONE_APARELHO: Record<string, typeof Monitor> = {
  celular: Smartphone,
  computador: Monitor,
  tablet: Tablet,
};

export function HistoricoNavegacao({ h }: { h: HistoricoVisitante }) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5">
      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
        O que olhou no site
      </h2>
      <p className="text-xs text-gray-400 mt-0.5 mb-4">
        {h.sessoes} visita{h.sessoes === 1 ? "" : "s"}
        {h.visitantes > 1 && ` em ${h.visitantes} aparelhos`}
        {h.ultimoAcesso && ` · última em ${dataHora.format(h.ultimoAcesso)}`}
        {h.identificadoPor && ` · reconhecido ${ORIGEM[h.identificadoPor] ?? ""}`}
      </p>

      {h.aparelhos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {h.aparelhos.map((a) => {
            const Icone = ICONE_APARELHO[a] ?? Monitor;
            return (
              <span
                key={a}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
              >
                <Icone className="w-3 h-3 text-gray-400" aria-hidden="true" />
                {a}
              </span>
            );
          })}
        </div>
      )}

      {h.produtos.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-gray-500 mb-1.5">
            Peixes que abriu
          </h3>
          <ul className="space-y-1">
            {h.produtos.map((p) => (
              <li key={p.produtoId} className="flex items-baseline justify-between gap-3 text-sm">
                <Link
                  href={`/admin/produtos/${p.produtoId}/editar`}
                  className="text-[#07366A] hover:text-[#FF035C] truncate"
                  title={p.nome}
                >
                  {p.nome}
                </Link>
                <span className="shrink-0 text-xs text-gray-400 tabular-nums">
                  {p.vezes}×{" "}
                  <span className="text-gray-300">
                    · {dataHora.format(p.ultimaVez)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {h.buscas.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-medium text-gray-500 mb-1.5">O que buscou</h3>
          <ul className="flex flex-wrap gap-1.5">
            {h.buscas.map((b) => (
              <li
                key={b.termo}
                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-600"
              >
                <Search className="w-3 h-3 text-gray-400" aria-hidden="true" />
                {b.termo}
                {b.vezes > 1 && <span className="text-gray-400">{b.vezes}×</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-[#07366A] inline-flex items-center gap-1">
          <Clock className="w-3 h-3" aria-hidden="true" />
          Últimos passos
        </summary>
        <ol className="mt-2 space-y-1 border-l border-gray-200 pl-3">
          {h.ultimosEventos.map((e, i) => (
            <li key={`${e.tipo}-${i}`} className="text-xs text-gray-500">
              <span className="text-gray-700">
                {EVENTO_LABEL[e.tipo] ?? e.tipo}
              </span>
              {e.detalhe && <span className="text-gray-400"> · {e.detalhe}</span>}
              <span className="block text-gray-300">
                {dataHora.format(e.ocorridoEm)}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
