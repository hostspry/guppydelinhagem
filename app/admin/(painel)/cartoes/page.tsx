import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { listarTentativasCartao } from "@/lib/queries/tentativas-cartao";

export const dynamic = "force-dynamic";

// Cada tentativa de cartão que não virou venda. A tela existe porque, quando um
// cliente avisou que "deu recusado", não havia onde olhar: o pagamento não
// chegou a existir no gateway e o site não guardava nada.

const ETAPAS = [
  { valor: "RECUSA", label: "Recusado pelo banco" },
  { valor: "FORMULARIO", label: "Erro no formulário" },
  { valor: "COBRANCA", label: "Falha na cobrança" },
  { valor: "SDK", label: "Formulário não carregou" },
] as const;

const BADGE: Record<string, { label: string; classe: string; ajuda: string }> = {
  RECUSA: {
    label: "Recusado pelo banco",
    classe: "bg-red-100 text-red-700",
    ajuda: "O gateway cobrou e o banco do cliente negou. Vale chamar no WhatsApp.",
  },
  FORMULARIO: {
    label: "Erro no formulário",
    classe: "bg-amber-100 text-amber-800",
    ajuda:
      "O cartão nem chegou a ser cobrado: dados incompletos ou recusados na digitação.",
  },
  COBRANCA: {
    label: "Falha na cobrança",
    classe: "bg-violet-100 text-violet-700",
    ajuda: "A cobrança não saiu (rede, gateway fora, erro nosso). Se repetir, é defeito.",
  },
  SDK: {
    label: "Formulário não carregou",
    classe: "bg-gray-200 text-gray-700",
    ajuda: "O cliente nem viu os campos do cartão. Se repetir, é defeito nosso.",
  },
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dataHoraBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

type Props = { searchParams: Promise<{ etapa?: string }> };

export default async function CartoesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const etapaFiltro = ETAPAS.find((e) => e.valor === sp.etapa)?.valor;

  const { linhas, contagem, total } = await listarTentativasCartao(etapaFiltro);

  return (
    <div>
      <PageHeader
        title="Cartões recusados"
        description="Toda tentativa de cartão que não virou venda, com o motivo técnico. Serve para separar cartão do cliente de defeito nosso."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Cartões" }]}
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link
          href="/admin/cartoes"
          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
            !etapaFiltro
              ? "bg-[#07366A] text-white border-[#07366A]"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          Tudo ({total} em 30 dias)
        </Link>
        {ETAPAS.map((e) => (
          <Link
            key={e.valor}
            href={`/admin/cartoes?etapa=${e.valor}`}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              etapaFiltro === e.valor
                ? "bg-[#07366A] text-white border-[#07366A]"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {e.label} ({contagem[e.valor] ?? 0})
          </Link>
        ))}
      </div>

      {etapaFiltro && (
        <p className="text-xs text-gray-500 mb-3">{BADGE[etapaFiltro].ajuda}</p>
      )}

      {linhas.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-6 text-center">
          Nenhuma tentativa de cartão frustrada por aqui. É o que a gente quer ver.
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {linhas.map((l) => {
            const badge = BADGE[l.etapa];
            const tel = (l.telefone ?? "").replace(/\D/g, "");
            return (
              <div key={l.id} className="p-4 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.classe}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {dataHoraBR.format(l.criadoEm)}
                  </span>
                  {l.valor != null && (
                    <span className="font-semibold text-[#07366A]">
                      {moeda.format(l.valor)}
                      {l.parcelas ? ` · ${l.parcelas}x` : ""}
                    </span>
                  )}
                  {l.numero && (
                    <span className="text-xs text-gray-600">
                      pedido {l.numero}
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-700 break-words">
                  {l.mensagem}
                  {l.statusDetail ? (
                    <span className="text-gray-400"> ({l.statusDetail})</span>
                  ) : null}
                </p>

                {/* Sem fingerprint, o antifraude do MP recusa cartão bom. É a
                    primeira coisa a conferir quando a recusa não faz sentido. */}
                {l.etapa === "RECUSA" && !l.deviceOk && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-700">
                    <AlertTriangle size={13} aria-hidden="true" />
                    Sem o antifraude do dispositivo nesta tentativa.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  {l.email && <span>{l.email}</span>}
                  {tel && (
                    <a
                      href={`https://wa.me/${tel.startsWith("55") ? tel : `55${tel}`}?text=${encodeURIComponent(
                        "Olá! Vi que você tentou pagar no cartão aqui na loja. Posso ajudar a finalizar?",
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#FF035C] hover:underline"
                    >
                      Chamar no WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
