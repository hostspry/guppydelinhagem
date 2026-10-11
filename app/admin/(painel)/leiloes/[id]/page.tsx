import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { LeilaoForm } from "@/components/admin/leiloes/LeilaoForm";
import { LotesLeilao } from "@/components/admin/leiloes/LotesLeilao";
import { CobrancasLeilao } from "@/components/admin/leiloes/CobrancasLeilao";
import { ExcluirLeilao } from "@/components/admin/leiloes/ExcluirLeilao";
import { getLeilaoAdmin } from "@/lib/queries/leiloes";
import { dataLeilaoBR, diaISO } from "@/lib/leiloes/situacao";

export const dynamic = "force-dynamic";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function LeilaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const l = await getLeilaoAdmin(id);
  if (!l) notFound();

  const data = dataLeilaoBR(l.dataLeilao);
  const r = l.resumo;
  const cards = [
    { label: "Arrematado", valor: moeda.format(r.totalArrematado), extra: `${l.lotes.length} lote(s), ${r.arrematantes} arrematante(s)` },
    { label: "Recebido", valor: moeda.format(r.recebido), extra: `${r.pagas} cobrança(s) paga(s)`, cor: "text-green-700" },
    { label: "A receber", valor: moeda.format(r.aReceber), extra: `${r.abertas} cobrança(s) em aberto`, cor: r.aReceber > 0 ? "text-amber-700" : undefined },
    { label: "Sem cobrança", valor: String(r.lotesSemCobranca), extra: r.lotesSemCobranca ? "lote(s) esperando o Cobrar" : "todos cobrados", cor: r.lotesSemCobranca ? "text-[#FF035C]" : undefined },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={l.nome}
        description={`Leilão de ${data} · prazo de ${l.prazoPagamentoDias} dia(s) para pagar · até ${l.maxParcelas}x no cartão`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Leilões", href: "/admin/leiloes" },
          { label: l.nome },
        ]}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`text-xl font-bold ${c.cor ?? "text-[#07366A]"}`}>{c.valor}</p>
            <p className="text-[11px] text-gray-400">{c.extra}</p>
          </div>
        ))}
      </div>

      <LotesLeilao
        leilaoId={l.id}
        lotes={l.lotes.map((x) => ({
          id: x.id,
          numero: x.numero,
          nome: x.nome,
          qtdPeixes: x.qtdPeixes,
          valor: x.valor,
          cliente: x.cliente,
          cobranca: x.cobranca,
        }))}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#07366A]">Cobranças por arrematante</h2>
        <CobrancasLeilao
          dataLeilao={data}
          cobrancas={l.cobrancas.map((c) => ({
            ...c,
            expiraEm: c.expiraEm ? c.expiraEm.toISOString() : null,
            entregaEscolhida: !!c.entregaEscolhidaEm,
            ultimoPagamento: c.ultimoPagamento
              ? { ...c.ultimoPagamento, criadoEm: c.ultimoPagamento.criadoEm.toISOString() }
              : null,
          }))}
        />
      </section>

      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-[#07366A] select-none">
          Dados do leilão (nome, data, prazo, parcelas)
        </summary>
        <div className="mt-3 space-y-3">
          <LeilaoForm
            leilao={{
              id: l.id,
              nome: l.nome,
              dataLeilao: diaISO(l.dataLeilao),
              prazoPagamentoDias: l.prazoPagamentoDias,
              maxParcelas: l.maxParcelas,
              observacoes: l.observacoes,
            }}
          />
          <p className="text-xs text-gray-400">
            Prazo e parcelas valem para as próximas cobranças. As já geradas mantêm o que tinham
            (use &quot;+3 dias de prazo&quot; na cobrança).
          </p>
          {l.cobrancas.length === 0 && <ExcluirLeilao id={l.id} nome={l.nome} />}
        </div>
      </details>
    </div>
  );
}
