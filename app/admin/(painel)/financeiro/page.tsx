import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Scale,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { NavegacaoMes } from "@/components/admin/financeiro/NavegacaoMes";
import { ListaLancamentos } from "@/components/admin/financeiro/ListaLancamentos";
import {
  contadoresPendencia,
  resumoMensal,
  type ResumoMensal,
} from "@/lib/queries/financeiro";
import {
  competenciaAtual,
  ehCompetencia,
  moedaBR,
  rotuloCompetencia,
} from "@/lib/financeiro/periodo";

/** Barras do resumo por categoria, proporcionais ao maior valor do grupo. */
function PorCategoria({ dados }: { dados: ResumoMensal["porCategoria"] }) {
  const saidas = dados.filter((d) => d.tipo === "SAIDA");
  const entradas = dados.filter((d) => d.tipo === "ENTRADA");

  if (saidas.length === 0 && entradas.length === 0) return null;

  const grupos = [
    { titulo: "Para onde foi o dinheiro", itens: saidas, cor: "bg-[#FF035C]" },
    { titulo: "De onde veio o dinheiro", itens: entradas, cor: "bg-green-600" },
  ].filter((g) => g.itens.length > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      {grupos.map((g) => {
        const maior = Math.max(...g.itens.map((i) => i.total));
        return (
          <div
            key={g.titulo}
            className="bg-white border border-gray-200 rounded-lg p-4"
          >
            <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
              {g.titulo}
            </h2>
            <ul className="space-y-2">
              {g.itens.map((i) => (
                <li key={`${i.tipo}-${i.categoriaId ?? "sem"}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{i.nome}</span>
                    <span className="text-[#07366A] font-medium">
                      {moedaBR.format(i.total)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${g.cor} rounded-full`}
                      style={{
                        width: `${maior > 0 ? Math.max((i.total / maior) * 100, 2) : 0}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const competencia = mes && ehCompetencia(mes) ? mes : competenciaAtual();

  const [resumo, pendencias] = await Promise.all([
    resumoMensal(competencia),
    contadoresPendencia(),
  ]);

  const temPendencia =
    pendencias.sugestoes > 0 || pendencias.vencidas > 0 || pendencias.venceEm7Dias > 0;

  return (
    <div>
      <PageHeader
        title="Caixa"
        description="Entradas e saídas do mês, com o saldo que sobrou."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Financeiro" }]}
        action={
          <div className="flex gap-2">
            <Link
              href="/admin/financeiro/pendencias"
              className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-gray-400 transition-all"
            >
              Pendências
              {temPendencia && (
                <span className="bg-[#FF035C] text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5">
                  {pendencias.sugestoes + pendencias.vencidas}
                </span>
              )}
            </Link>
            <Link
              href="/admin/financeiro/novo"
              className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Novo lançamento
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <NavegacaoMes competencia={competencia} />
        <div className="flex gap-3 text-xs">
          <Link
            href="/admin/financeiro/recorrentes"
            className="text-gray-500 hover:text-[#FF035C]"
          >
            Contas fixas
          </Link>
          <Link
            href="/admin/financeiro/categorias"
            className="text-gray-500 hover:text-[#FF035C]"
          >
            Categorias
          </Link>
        </div>
      </div>

      {temPendencia && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {[
            pendencias.sugestoes > 0 &&
              `${pendencias.sugestoes} venda(s) do site esperando conferência`,
            pendencias.vencidas > 0 && `${pendencias.vencidas} conta(s) vencida(s)`,
            pendencias.venceEm7Dias > 0 &&
              `${pendencias.venceEm7Dias} vence(m) nos próximos 7 dias`,
          ]
            .filter(Boolean)
            .join(" · ")}
          .{" "}
          <Link href="/admin/financeiro/pendencias" className="underline font-medium">
            Resolver agora
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={ArrowUpCircle}
          label="Entrou"
          value={moedaBR.format(resumo.entradas)}
          description={rotuloCompetencia(competencia)}
        />
        <StatCard
          icon={ArrowDownCircle}
          label="Saiu"
          value={moedaBR.format(resumo.saidas)}
          description={rotuloCompetencia(competencia)}
        />
        <StatCard
          icon={Scale}
          label="Saldo do mês"
          value={moedaBR.format(resumo.saldo)}
          description={resumo.saldo >= 0 ? "sobrou" : "faltou"}
        />
        <StatCard
          icon={Wallet}
          label="Acumulado"
          value={moedaBR.format(resumo.saldoAcumulado)}
          description="de todos os meses até aqui"
        />
      </div>

      <PorCategoria dados={resumo.porCategoria} />

      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-2">
        Lançamentos do mês
      </h2>
      <ListaLancamentos
        lancamentos={resumo.lancamentos}
        vazio="Nenhum lançamento neste mês ainda."
      />
    </div>
  );
}
