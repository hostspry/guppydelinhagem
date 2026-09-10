import Link from "next/link";
import {
  Eye,
  MousePointerClick,
  LogOut,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { LimpezaRastreio } from "@/components/admin/LimpezaRastreio";
import { SeletorPeriodo } from "@/components/admin/visitantes/SeletorPeriodo";
import { GraficoMovimento } from "@/components/admin/visitantes/GraficoMovimento";
import { Funil } from "@/components/admin/visitantes/Funil";
import { BarrasRanking } from "@/components/admin/visitantes/BarrasRanking";
import { listarVisitantes, resumoRastreio } from "@/lib/queries/visitantes";
import {
  buscasMaisFeitas,
  cidades,
  dispositivos,
  ehPeriodo,
  funil,
  movimentoNoTempo,
  origens,
  pedidosPagosDoPeriodo,
  produtosDoPeriodo,
  resumoDoPeriodo,
  rotularInstante,
  type Periodo,
} from "@/lib/queries/visitantes-analise";

export const dynamic = "force-dynamic";

const dataHoraBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const dataBR = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

const NOME_PERIODO: Record<Periodo, string> = {
  dia: "hoje",
  semana: "nos últimos 7 dias",
  mes: "nos últimos 30 dias",
  ano: "nos últimos 12 meses",
};

/** Cartão com título, para os blocos de análise não repetirem o mesmo markup. */
function Bloco({
  titulo,
  ajuda,
  children,
  className = "",
}: {
  titulo: string;
  ajuda?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
        {titulo}
      </h2>
      {ajuda && <p className="text-xs text-gray-400 mt-0.5 mb-3">{ajuda}</p>}
      {!ajuda && <div className="mb-3" />}
      {children}
    </section>
  );
}

export default async function VisitantesPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; periodo?: string }>;
}) {
  const sp = await searchParams;
  const pagina = Number(sp.p) > 0 ? Number(sp.p) : 1;
  const periodo: Periodo = ehPeriodo(sp.periodo) ? sp.periodo : "mes";

  const [
    lista,
    resumoGeral,
    resumo,
    movimento,
    etapas,
    fontes,
    aparelhos,
    locais,
    buscas,
    produtos,
    pedidosPagos,
  ] = await Promise.all([
    listarVisitantes(pagina),
    resumoRastreio(),
    resumoDoPeriodo(periodo),
    movimentoNoTempo(periodo),
    funil(periodo),
    origens(periodo),
    dispositivos(periodo),
    cidades(periodo),
    buscasMaisFeitas(periodo),
    produtosDoPeriodo(periodo),
    pedidosPagosDoPeriodo(periodo),
  ]);

  const pontos = movimento.map((m) => {
    const r = rotularInstante(m.instante, periodo);
    return { rotulo: r.curto, completo: r.completo, sessoes: m.sessoes, pessoas: m.pessoas };
  });

  const quando = NOME_PERIODO[periodo];
  const taxaSaida =
    resumo.sessoes > 0 ? Math.round((resumo.saidaDireta / resumo.sessoes) * 100) : 0;
  const subiu = (resumo.variacaoSessoes ?? 0) >= 0;

  return (
    <div>
      <PageHeader
        title="Visitantes"
        description="Quem entrou no site, de onde veio, e o que olhou."
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Visitantes" }]}
        action={<LimpezaRastreio pendentes={resumoGeral.temMaisDe90Dias} />}
      />

      {resumoGeral.temMaisDe90Dias > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Existem <strong>{resumoGeral.temMaisDe90Dias}</strong> registros com mais
          de 90 dias
          {resumoGeral.registroMaisAntigo && (
            <> (o mais antigo é de {dataBR.format(resumoGeral.registroMaisAntigo)})</>
          )}
          . Nada é apagado sozinho — se não precisar mais deles, use o botão de
          limpar aí em cima.
        </div>
      )}

      {/* Filtro numa linha só, acima de tudo: vale para a página inteira. */}
      <div className="mb-4">
        <SeletorPeriodo atual={periodo} />
      </div>

      {/* ── Números do período ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={MousePointerClick}
          label="Visitas"
          value={resumo.sessoes.toLocaleString("pt-BR")}
          description={
            resumo.variacaoSessoes === null
              ? `${quando} · sem período anterior para comparar`
              : `${subiu ? "+" : ""}${resumo.variacaoSessoes}% contra o período anterior`
          }
        />
        <StatCard
          icon={Users}
          label="Pessoas"
          value={resumo.pessoas.toLocaleString("pt-BR")}
          description={`visitantes distintos ${quando}`}
        />
        <StatCard
          icon={UserPlus}
          label="Novos"
          value={resumo.novos.toLocaleString("pt-BR")}
          description="primeira vez no site"
        />
        <StatCard
          icon={LogOut}
          label="Entrou e saiu"
          value={`${taxaSaida}%`}
          description="visitas com uma página só"
        />
      </div>

      {/* ── Movimento ── */}
      <Bloco
        titulo="Movimento"
        ajuda={`Visitas e pessoas distintas ${quando}. A faixa entre as duas linhas é quem voltou: quanto mais larga, mais gente entrou no site mais de uma vez.`}
        className="mb-4"
      >
        <GraficoMovimento
          pontos={pontos}
          descricao={`Visitas e pessoas distintas ${quando}`}
        />
      </Bloco>

      {/* ── Funil + origens ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Bloco
          titulo="Do site ao pedido"
          ajuda="Pessoas distintas em cada passo. Onde a barra encolhe muito é onde se perde venda."
        >
          <Funil etapas={etapas} pedidosPagos={pedidosPagos} />
        </Bloco>

        <Bloco titulo="De onde vieram" ajuda="Origem da visita: UTM quando existe, senão o site que trouxe.">
          <BarrasRanking itens={fontes.map((f) => ({ rotulo: f.rotulo, total: f.total }))} />
        </Bloco>
      </div>

      {/* ── Aparelho + cidades ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Bloco titulo="Em que aparelho" ajuda="Como o site foi aberto.">
          <BarrasRanking itens={aparelhos.map((a) => ({ rotulo: a.rotulo, total: a.total }))} />
        </Bloco>

        <Bloco
          titulo="De onde no Brasil"
          ajuda={
            locais.semLocalizacao > 0
              ? `Só aparece quem aceitou o rastreio. Outras ${locais.semLocalizacao.toLocaleString("pt-BR")} visitas ficaram sem localização.`
              : "Só aparece quem aceitou o rastreio."
          }
        >
          <BarrasRanking
            itens={locais.itens.map((c) => ({
              rotulo: c.cidade,
              extra: c.uf ?? undefined,
              total: c.total,
            }))}
            vazio="Ninguém com localização nesse período."
          />
        </Bloco>
      </div>

      {/* ── Buscas + produtos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Bloco
          titulo="O que procuraram"
          ajuda="O pedido do cliente em palavras dele. Termo que repete e não tem peixe correspondente é linhagem a criar."
        >
          {buscas.length === 0 ? (
            <p className="text-sm text-gray-500">Ninguém usou a busca nesse período.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {buscas.map((b) => (
                <li
                  key={b.termo}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600"
                >
                  <Search className="w-3 h-3 text-gray-400" aria-hidden="true" />
                  {b.termo}
                  <span className="font-semibold text-[#07366A]">{b.vezes}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco titulo="Peixes mais olhados" ajuda="Quantos abriram a página e quantos puseram no carrinho.">
          {produtos.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum produto olhado nesse período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400">
                  <th className="pb-2 font-medium">Produto</th>
                  <th className="pb-2 text-right w-20 font-medium">Olhadas</th>
                  <th className="pb-2 text-right w-24 font-medium">Carrinho</th>
                  <th className="pb-2 text-right w-16 font-medium">Taxa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {produtos.map((p) => (
                  <tr key={p.produtoId}>
                    <td className="py-1.5 text-[#07366A] truncate max-w-0" title={p.nome}>
                      {p.nome}
                    </td>
                    <td className="py-1.5 text-right text-gray-600 tabular-nums">{p.vistas}</td>
                    <td className="py-1.5 text-right text-gray-600 tabular-nums">{p.carrinho}</td>
                    <td className="py-1.5 text-right text-gray-400 tabular-nums">
                      {p.vistas > 0 ? `${Math.round((p.carrinho / p.vistas) * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Bloco>
      </div>

      {/* ── Lista (não segue o período: é o histórico de quem já veio) ── */}
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Últimos visitantes
        </h2>
        <span className="text-xs text-gray-400 inline-flex items-center gap-1">
          <Eye className="w-3 h-3" aria-hidden="true" />
          {resumoGeral.visitantes.toLocaleString("pt-BR")} pessoas desde o começo
        </span>
      </div>

      {lista.itens.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
          Ninguém registrado ainda. A partir de agora, cada visita ao site
          aparece aqui.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Quem</th>
                <th className="px-4 py-3">De onde</th>
                <th className="px-4 py-3 text-center w-20">Visitas</th>
                <th className="px-4 py-3 text-center w-20">Passos</th>
                <th className="px-4 py-3 w-32">Última vez</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.itens.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/visitantes/${v.id}`}
                      className="text-[#07366A] hover:text-[#FF035C] font-medium"
                    >
                      {v.clienteNome ?? "Visitante anônimo"}
                    </Link>
                    {v.comprou && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                        comprou
                      </span>
                    )}
                    {v.clienteEmail && (
                      <span className="block text-xs text-gray-400 break-all">
                        {v.clienteEmail}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {v.ultimaCidade ?? "—"}
                    <span className="block text-xs text-gray-400">
                      {[v.ultimoProvedor, v.ultimoDispositivo, v.ultimoIp]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {v.totalSessoes}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {v.totalEventos}
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {dataHoraBR.format(v.ultimoAcesso)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lista.paginas > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-gray-500">
            {lista.total} visitante(s) · página {pagina} de {lista.paginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link
                href={`/admin/visitantes?periodo=${periodo}&p=${pagina - 1}`}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:border-gray-400"
              >
                Anterior
              </Link>
            )}
            {pagina < lista.paginas && (
              <Link
                href={`/admin/visitantes?periodo=${periodo}&p=${pagina + 1}`}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:border-gray-400"
              >
                Próxima
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
