import Link from "next/link";
import { Plus, Search, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import {
  listCobrancas,
  cancelarCobrancasExpiradas,
  type SituacaoCobranca,
} from "@/lib/queries/cobrancas";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ situacao?: string; q?: string }>;
};

const SITUACOES: { valor: SituacaoCobranca; label: string }[] = [
  { valor: "ABERTA", label: "Abertas" },
  { valor: "PAGA", label: "Pagas" },
  { valor: "EXPIRADA", label: "Vencidas" },
  { valor: "CANCELADA", label: "Canceladas" },
];

const BADGE: Record<SituacaoCobranca, { label: string; classe: string }> = {
  ABERTA: { label: "Aguardando", classe: "bg-blue-100 text-blue-700" },
  PAGA: { label: "Paga", classe: "bg-green-100 text-green-700" },
  EXPIRADA: { label: "Vencida", classe: "bg-gray-100 text-gray-600" },
  CANCELADA: { label: "Cancelada", classe: "bg-gray-100 text-gray-500" },
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dataBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

function href(situacao: string, q: string) {
  const p = new URLSearchParams();
  if (situacao) p.set("situacao", situacao);
  if (q) p.set("q", q);
  const qs = p.toString();
  return qs ? `/admin/cobrancas?${qs}` : "/admin/cobrancas";
}

export default async function CobrancasPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const situacao = SITUACOES.some((s) => s.valor === sp.situacao)
    ? (sp.situacao as SituacaoCobranca)
    : undefined;

  // Fecha na entrada o que passou da validade (mesma ideia da limpeza de
  // pedidos órfãos): a lista já mostra a verdade, sem cron.
  await cancelarCobrancasExpiradas();
  const cobrancas = await listCobrancas({ situacao, q });

  return (
    <div>
      <PageHeader
        title="Cobrança avulsa"
        description="Gere um link de pagamento e mande para o cliente. Ele paga no Pix ou no cartão."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Cobranças" }]}
        action={
          <Link
            href="/admin/cobrancas/nova"
            className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Nova cobrança
          </Link>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link
          href={href("", q)}
          className={`text-xs px-3 py-1.5 rounded-full border ${
            situacao
              ? "border-gray-200 text-gray-600 hover:bg-gray-50"
              : "border-[#07366A] bg-[#07366A] text-white"
          }`}
        >
          Todas
        </Link>
        {SITUACOES.map((s) => (
          <Link
            key={s.valor}
            href={href(s.valor, q)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              situacao === s.valor
                ? "border-[#07366A] bg-[#07366A] text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s.label}
          </Link>
        ))}

        <form action="/admin/cobrancas" className="ml-auto relative">
          {situacao && <input type="hidden" name="situacao" value={situacao} />}
          <Search
            className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Número, cliente ou descrição"
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm w-64 focus:outline-none focus:border-[#FF035C]"
          />
        </form>
      </div>

      {cobrancas.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-sm text-gray-500 mb-3">
            {q || situacao
              ? "Nada com esse filtro."
              : "Nenhuma cobrança avulsa por aqui ainda."}
          </p>
          <Link
            href="/admin/cobrancas/nova"
            className="text-sm text-[#FF035C] hover:underline font-medium"
          >
            Gerar a primeira cobrança →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Criada</th>
                <th className="px-4 py-3">Vence</th>
                <th className="px-4 py-3 text-right w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cobrancas.map((c) => {
                const badge = BADGE[c.situacao];
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-[#07366A]">
                      <Link
                        href={`/admin/cobrancas/${c.id}`}
                        className="hover:underline"
                      >
                        {c.numero}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.clienteNome}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {c.descricao}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      {moeda.format(c.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${badge.classe}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {dataBR.format(c.criadoEm)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.expiraEm ? dataBR.format(c.expiraEm) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/cobrancas/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs text-[#FF035C] hover:underline"
                      >
                        Abrir
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
