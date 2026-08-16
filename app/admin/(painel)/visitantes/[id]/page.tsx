import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { getVisitante } from "@/lib/queries/visitantes";
import { EVENTO_LABEL, EVENTOS_IMPORTANTES } from "@/lib/rastreio/eventos";

const hora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Quanto tempo a visita durou, em linguagem de gente. */
function duracao(inicio: Date, fim: Date): string {
  const min = Math.round((fim.getTime() - inicio.getTime()) / 60000);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

export default async function VisitantePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dados = await getVisitante(id);
  if (!dados) notFound();

  const { visitante: v, sessoes } = dados;

  return (
    <div>
      <PageHeader
        title={v.clienteNome ?? "Visitante anônimo"}
        description={
          v.clienteEmail ??
          "Ainda não se identificou — os passos ficam ligados ao navegador dele."
        }
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Visitantes", href: "/admin/visitantes" },
          { label: "Jornada" },
        ]}
      />

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-gray-400">Primeira vez</div>
          <div className="text-[#07366A]">{dataHora.format(v.primeiroAcesso)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Última vez</div>
          <div className="text-[#07366A]">{dataHora.format(v.ultimoAcesso)}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Visitas</div>
          <div className="text-[#07366A]">{v.totalSessoes}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Passos registrados</div>
          <div className="text-[#07366A]">{v.totalEventos}</div>
        </div>
      </div>

      <div className="space-y-5">
        {sessoes.map((s) => (
          <div
            key={s.id}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
          >
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="font-medium text-[#07366A]">
                {dataHora.format(s.iniciadaEm)}
              </span>
              <span className="text-gray-400">
                {duracao(s.iniciadaEm, s.ultimaAtividade)}
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">
                {[s.cidade, s.regiao, s.pais].filter(Boolean).join(", ") ||
                  "local não consultado"}
              </span>
              {s.provedor && (
                <>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">{s.provedor}</span>
                </>
              )}
              <span className="text-gray-400">·</span>
              <span className="text-gray-600">
                {[s.dispositivo, s.navegador, s.sistema].filter(Boolean).join(" / ")}
              </span>
              {s.ip && (
                <>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500 font-mono">{s.ip}</span>
                </>
              )}
              {!s.consentimento && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600"
                  title="Sem aceite dos cookies: IP mascarado e sem geolocalização"
                >
                  sem consentimento
                </span>
              )}
            </div>

            {(s.referrer || s.utmSource) && (
              <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-100">
                Chegou de:{" "}
                <span className="text-gray-700 break-all">
                  {s.utmSource
                    ? `${s.utmSource}${s.utmCampaign ? ` · ${s.utmCampaign}` : ""}`
                    : s.referrer}
                </span>
              </div>
            )}

            <ol className="divide-y divide-gray-50">
              {s.eventos.map((e) => {
                const destaque = EVENTOS_IMPORTANTES.has(e.tipo);
                return (
                  <li
                    key={e.id}
                    className={`px-4 py-2 flex items-start gap-3 text-sm ${
                      destaque ? "" : "text-gray-500"
                    }`}
                  >
                    <span className="text-xs text-gray-400 w-12 shrink-0 pt-0.5">
                      {hora.format(e.ocorridoEm)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span
                        className={destaque ? "text-[#07366A] font-medium" : ""}
                      >
                        {EVENTO_LABEL[e.tipo] ?? e.tipo}
                      </span>
                      {e.produtoNome && (
                        <span className="text-gray-600"> — {e.produtoNome}</span>
                      )}
                      {e.busca && (
                        <span className="text-gray-600"> — “{e.busca}”</span>
                      )}
                      {e.quantidade != null && e.quantidade > 1 && (
                        <span className="text-gray-400"> ({e.quantidade}x)</span>
                      )}
                      {e.valor != null && e.valor > 0 && (
                        <span className="text-gray-400">
                          {" "}
                          · {moeda.format(e.valor)}
                        </span>
                      )}
                      {e.url && !e.produtoNome && (
                        <span className="block text-xs text-gray-400 break-all">
                          {e.url}
                        </span>
                      )}
                    </span>
                    {e.produtoId && (
                      <Link
                        href={`/admin/produtos/${e.produtoId}`}
                        className="text-xs text-gray-400 hover:text-[#FF035C] shrink-0"
                      >
                        ver
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
