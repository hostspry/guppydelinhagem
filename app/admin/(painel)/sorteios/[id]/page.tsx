import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Users,
  UserX,
  Ticket,
  TicketCheck,
  Link2,
  Hourglass,
  Pencil,
  Disc3,
  FileDown,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import {
  AcoesParticipante,
  DecidirLance,
  Homologar,
  ImportarForm,
  JustificativaBotao,
} from "@/components/admin/sorteios/Acoes";
import { getSorteioAdmin, STATUS_SORTEIO_LABEL, type SorteioAdmin } from "@/lib/queries/sorteios";
import { verificarCorrente } from "@/lib/sorteios/servico";
import { formatarFaixa } from "@/lib/sorteios/bilhetes";
import { formatarTelefone } from "@/lib/sorteios/telefone";
import { dataBR, dataHoraBR, STATUS_BADGE } from "@/lib/sorteios/formato";

export const metadata = { title: "Sorteio | Admin" };

const ABAS = [
  ["participantes", "Participantes"],
  ["lances", "Lances"],
  ["importar", "Importar"],
  ["homologacao", "Homologação"],
  ["auditoria", "Auditoria"],
] as const;
type Aba = (typeof ABAS)[number][0];

export default async function SorteioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; filtro?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await getSorteioAdmin(id);
  if (!s) notFound();
  const aba: Aba = (ABAS.find(([k]) => k === sp.aba)?.[0] ?? (s.participantes.length ? "participantes" : "importar")) as Aba;
  const i = s.indicadores;
  const revisar = s.lances.filter((l) => l.classificacao === "REVISAR").length;

  const etapas = [
    { nome: "Importar", feito: s.participantes.length > 0 },
    { nome: "Conferir", feito: s.participantes.length > 0 && revisar === 0 },
    { nome: "Homologar", feito: s.status === "HOMOLOGADO" || s.status === "REALIZADO" },
    { nome: "Sortear", feito: s.status === "REALIZADO" },
  ];

  return (
    <div>
      <PageHeader
        title={s.nome}
        description={`${s.premio} · ${s.organizador} · evento ${dataBR(s.dataEvento)}`}
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Sorteios", href: "/admin/sorteios" }, { label: s.nome }]}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/sorteios/${s.id}/editar`} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Pencil className="h-4 w-4" aria-hidden="true" /> Editar
            </Link>
            <Link href={`/api/admin/sorteios/${s.id}/exportar?tipo=participantes`} prefetch={false} className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <FileDown className="h-4 w-4" aria-hidden="true" /> Relatório
            </Link>
            <Link href={`/admin/sorteios/${s.id}/roleta`} className="inline-flex items-center gap-1.5 rounded-md bg-[#07366A] px-3 py-2 text-sm font-medium text-white hover:bg-[#0E4C8F]">
              <Disc3 className="h-4 w-4" aria-hidden="true" /> Roleta
            </Link>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE[s.status]}`}>{STATUS_SORTEIO_LABEL[s.status]}</span>
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {etapas.map((e, n) => (
            <li key={e.nome} className="flex items-center gap-1">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${e.feito ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {e.feito ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <span className="font-mono">{n + 1}</span>}
                {e.nome}
              </span>
              {n < etapas.length - 1 && <span className="text-gray-300">→</span>}
            </li>
          ))}
        </ol>
        {s.status === "CONFERENCIA" && s.participantes.length > 0 && (
          <span className="text-xs text-amber-700">Números preliminares, não homologados. Nada é publicado nem sorteado nesta fase.</span>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Users} label="Identificados" value={i.identificados} description={`de ${s.participantes.length} participantes`} />
        <StatCard icon={UserX} label="Pendentes" value={i.pendentesIdentificacao} description="só com nome, sem WhatsApp" />
        <StatCard icon={Ticket} label="Chances prelim." value={i.chancesPreliminares} description={s.lances.length ? `${s.lances.filter((l) => l.classificacao === "VALIDO").length} lances válidos importados` : "da lista importada"} />
        <StatCard icon={TicketCheck} label="Homologadas" value={i.chancesHomologadas ?? "—"} description={s.homologadoEm ? `em ${dataHoraBR(s.homologadoEm)}` : "ainda não"} />
        <StatCard icon={Link2} label="Em contas" value={i.creditosVinculados} description="créditos ligados a clientes" />
        <StatCard icon={Hourglass} label="Aguardando" value={i.creditosAguardando} description="WhatsApp ainda não verificado" />
        <StatCard icon={UserX} label="Sem número" value={i.creditosSoNome} description="créditos de quem só tem nome" />
        <StatCard icon={Disc3} label="Sorteio" value={s.status === "REALIZADO" ? `nº ${s.bilheteVencedor}` : s.dataSorteio ? dataBR(s.dataSorteio) : "sem data"} description={s.status === "REALIZADO" ? (s.vencedorPublico ?? "") : s.modoSorteio === "LOTERIA_FEDERAL" ? `Loteria Federal ${s.concursoLoteria ?? "(concurso a definir)"}` : "eletrônico"} />
      </div>

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200">
        {ABAS.map(([k, rotulo]) => (
          <Link
            key={k}
            href={`/admin/sorteios/${s.id}?aba=${k}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${aba === k ? "border-[#FF035C] text-[#07366A]" : "border-transparent text-gray-500 hover:text-[#07366A]"}`}
          >
            {rotulo}
            {k === "lances" && revisar > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">{revisar}</span>}
          </Link>
        ))}
      </nav>

      {aba === "participantes" && <AbaParticipantes s={s} />}
      {aba === "lances" && <AbaLances s={s} filtro={sp.filtro} />}
      {aba === "importar" && <AbaImportar s={s} />}
      {aba === "homologacao" && <AbaHomologacao s={s} revisar={revisar} />}
      {aba === "auditoria" && <AbaAuditoria s={s} />}
    </div>
  );
}

function SituacaoVinculo({ p }: { p: SorteioAdmin["participantes"][number] }) {
  if (p.user) {
    return (
      <span className="inline-flex flex-col">
        <span className="font-medium text-green-700">{p.user.nome}</span>
        <span className="text-xs text-gray-400">{p.vinculoOrigem === "ADMIN" ? "vínculo manual" : "WhatsApp verificado"}</span>
      </span>
    );
  }
  if (!p.telefone) return <span className="text-xs font-medium text-red-600">Sem WhatsApp: identificar</span>;
  return (
    <span className="inline-flex flex-col">
      <span className="text-xs font-medium text-amber-700">{p.verificacaoPendente ? "Verificação pedida: confira" : "Aguardando cadastro e verificação"}</span>
      {p.pistas.map((x, n) => (
        <span key={n} className="text-xs text-gray-500">
          Pista: {x.nome} ({x.origem})
        </span>
      ))}
    </span>
  );
}

function AbaParticipantes({ s }: { s: SorteioAdmin }) {
  if (s.participantes.length === 0) {
    return <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Nenhum participante ainda. Use a aba Importar.</p>;
  }
  const editavel = s.status === "CONFERENCIA";
  const total = s.totalBilhetes ?? s.totalCalculado;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-3">Nº</th>
            <th className="px-3 py-3">Participante</th>
            <th className="px-3 py-3 text-right">Chances</th>
            <th className="px-3 py-3">Bilhetes {s.status === "CONFERENCIA" && <span className="normal-case text-amber-600">(provisórios)</span>}</th>
            <th className="px-3 py-3 text-center">Lances</th>
            <th className="px-3 py-3">Conta</th>
            <th className="px-3 py-3">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {s.participantes.map((p) => {
            const temLances = p.lancesValidos + p.lancesInvalidos + p.lancesRevisar > 0;
            const diverge = temLances && p.lancesValidos !== p.chances;
            return (
              <tr key={p.id} className={`align-top ${s.participanteVencedorId === p.id ? "bg-green-50" : ""}`}>
                <td className="px-3 py-3 text-gray-400">{p.ordem}</td>
                <td className="px-3 py-3">
                  <span className="font-medium text-[#07366A]">{p.telefone ? formatarTelefone(p.telefone) : p.nomeOrigem}</span>
                  {p.telefone && p.nomeOrigem !== formatarTelefone(p.telefone) && <span className="block text-xs text-gray-400">{p.nomeOrigem}</span>}
                  <span className="block text-xs text-gray-400">público: {p.nomePublico}</span>
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#07366A]">{p.chances}</td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{formatarFaixa(p.faixa, total)}</td>
                <td className="px-3 py-3 text-center text-xs">
                  {temLances ? (
                    <span className={diverge ? "font-semibold text-amber-700" : "text-gray-600"} title="válidos / inválidos / revisar">
                      {p.lancesValidos}/{p.lancesInvalidos}/{p.lancesRevisar}
                      {diverge && <span className="block">≠ chances</span>}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <SituacaoVinculo p={p} />
                </td>
                <td className="px-3 py-3">
                  {s.status !== "CANCELADO" && <AcoesParticipante sorteioId={s.id} p={p} editavel={editavel} />}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="border-t border-gray-200 bg-gray-50 text-sm font-semibold text-[#07366A]">
          <tr>
            <td className="px-3 py-3" colSpan={2}>
              Total
            </td>
            <td className="px-3 py-3 text-right tabular-nums">{s.indicadores.chancesPreliminares}</td>
            <td className="px-3 py-3 font-mono text-xs">{total > 0 ? formatarFaixa({ inicio: 1, fim: total }, total) : "—"}</td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function AbaLances({ s, filtro }: { s: SorteioAdmin; filtro?: string }) {
  if (s.lances.length === 0) {
    return (
      <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Nenhum lance importado. A lista de participantes já basta para sortear; a auditoria lance a lance serve para conferir as chances.
      </p>
    );
  }
  const lista = filtro ? s.lances.filter((l) => l.classificacao === filtro) : s.lances;
  const editavel = s.status === "CONFERENCIA";
  const filtros = [
    [undefined, "Todos", s.lances.length],
    ["REVISAR", "Revisar", s.lances.filter((l) => l.classificacao === "REVISAR").length],
    ["VALIDO", "Válidos", s.lances.filter((l) => l.classificacao === "VALIDO").length],
    ["INVALIDO", "Inválidos", s.lances.filter((l) => l.classificacao === "INVALIDO").length],
  ] as const;
  const cor = { VALIDO: "text-green-700", INVALIDO: "text-gray-500", REVISAR: "text-amber-700 font-semibold" };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {filtros.map(([f, rotulo, n]) => (
          <Link key={rotulo} href={`/admin/sorteios/${s.id}?aba=lances${f ? `&filtro=${f}` : ""}`} className={`rounded-full px-3 py-1 text-xs ${filtro === f ? "bg-[#07366A] text-white" : "bg-white text-gray-600 ring-1 ring-gray-200"}`}>
            {rotulo} ({n})
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Lote</th>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Participante</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Situação</th>
              <th className="px-3 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="px-3 py-2 font-mono text-xs">
                  {l.loteId}
                  {l.loteRotulo && <span className="block text-gray-400">nº {l.loteRotulo}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-400">{l.sequencia}</td>
                <td className="px-3 py-2 text-xs">
                  {l.autor}
                  {!l.participanteId && <span className="block text-red-600">fora da lista</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{l.valor != null ? l.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "?"}</td>
                <td className="px-3 py-2 text-xs">{l.tipo === "NORMAL" ? "" : l.tipo === "XEQUE_MATE" ? "Xeque-Mate" : "Mestre Criador"}</td>
                <td className={`px-3 py-2 text-xs ${cor[l.classificacao]}`}>
                  {l.classificacao}
                  {l.decididoPorNome && <span className="block font-normal text-gray-400">por {l.decididoPorNome}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {l.motivo}
                  {l.classificacao === "REVISAR" && editavel && (
                    <div className="mt-2">
                      <DecidirLance sorteioId={s.id} lanceId={l.id} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AbaImportar({ s }: { s: SorteioAdmin }) {
  if (s.status !== "CONFERENCIA") {
    return <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">A lista está {s.status === "HOMOLOGADO" ? "homologada" : "encerrada"}. Para importar de novo, retifique a homologação.</p>;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-[#07366A]">Participantes e chances</h2>
        <p className="text-xs text-gray-500">
          Colunas: <code>Nº</code>, <code>WhatsApp / Participante</code> (ou <code>participante</code>, <code>whatsapp</code>), <code>Chances</code>. A coluna <code>Bilhetes provisórios</code>, se vier, é conferida contra a numeração calculada. Reimportar não duplica: a chave é o WhatsApp (ou o nome, para quem não tem número).
        </p>
        <ImportarForm sorteioId={s.id} tipo="participantes" jaTemDados={s.participantes.length > 0} />
      </section>
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-[#07366A]">Auditoria de lances</h2>
        <p className="text-xs text-gray-500">
          Colunas: <code>lote_id</code> (ID interno único do lote), <code>lote</code> (número público), <code>sequencia</code>, <code>horario</code>, <code>encerramento</code>, <code>participante</code>, <code>whatsapp</code>, <code>valor</code>, <code>tipo</code> (normal, Xeque-Mate, Mestre Criador), <code>classificacao</code> (o que a planilha concluiu). Xeque-Mate, Mestre Criador e divergências com a planilha vão para revisão.
        </p>
        <ImportarForm sorteioId={s.id} tipo="lances" jaTemDados={s.lances.length > 0} />
      </section>
    </div>
  );
}

function AbaHomologacao({ s, revisar }: { s: SorteioAdmin; revisar: number }) {
  const soNome = s.participantes.filter((p) => !p.telefone && !p.userId && p.chances > 0);
  const bloqueio = revisar > 0 ? `Há ${revisar} lance(s) para revisar.` : s.modoSorteio === "LOTERIA_FEDERAL" && !s.concursoLoteria ? "Defina o concurso da Loteria Federal (Editar)." : s.participantes.length === 0 ? "Importe os participantes primeiro." : null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-[#07366A]">Lista definitiva</h2>
        {s.status === "CONFERENCIA" && (
          <>
            {soNome.length > 0 && (
              <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                {soNome.length} participante(s) só com nome ({soNome.map((p) => p.nomeOrigem).join(", ")}). Os bilhetes entram na lista, mas a conta só é ligada quando o WhatsApp for confirmado.
              </p>
            )}
            <Homologar sorteioId={s.id} total={s.totalCalculado} bloqueio={bloqueio} />
          </>
        )}
        {s.status !== "CONFERENCIA" && s.hashLista && (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-400">Homologada por</dt>
              <dd>
                {s.homologadoPorNome} em {dataHoraBR(s.homologadoEm)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Bilhetes</dt>
              <dd>{s.totalBilhetes}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">SHA-256 da lista</dt>
              <dd className="break-all font-mono text-xs">{s.hashLista}</dd>
            </div>
            <Link href={`/api/admin/sorteios/${s.id}/exportar?tipo=lista`} prefetch={false} className="inline-block text-xs font-medium text-[#FF035C] hover:underline">
              Baixar a lista canônica (o texto exato que gera o hash)
            </Link>
          </dl>
        )}
        {s.status === "HOMOLOGADO" && (
          <JustificativaBotao sorteioId={s.id} acao="retificar" rotulo="Retificar homologação" aviso="A lista volta para conferência e o hash atual é descartado. O hash antigo e a justificativa ficam no histórico." />
        )}
      </section>
      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-[#07366A]">Resultado</h2>
        {s.status === "REALIZADO" ? (
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-400">Bilhete vencedor</dt>
              <dd className="text-2xl font-bold text-[#FF035C]">{s.bilheteVencedor}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Vencedor</dt>
              <dd>
                {(() => {
                  const v = s.participantes.find((p) => p.id === s.participanteVencedorId);
                  return v ? `${v.user?.nome ?? v.nomeOrigem} · ${v.telefone ? formatarTelefone(v.telefone) : "sem WhatsApp"} (público: ${s.vencedorPublico})` : s.vencedorPublico;
                })()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Realizado</dt>
              <dd>
                {dataHoraBR(s.realizadoEm)} por {s.realizadoPorNome}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400">Método</dt>
              <dd className="text-xs">{s.metodoSorteio}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-gray-500">Ainda não sorteado. O sorteio acontece na tela da roleta, só com a lista homologada.</p>
        )}
        {s.status !== "CANCELADO" && (
          <JustificativaBotao sorteioId={s.id} acao="cancelar" perigo rotulo="Cancelar sorteio" aviso="Cancelar tira o sorteio da página pública. Se já houver resultado, ele continua no histórico." />
        )}
      </section>
    </div>
  );
}

async function AbaAuditoria({ s }: { s: SorteioAdmin }) {
  const corrente = await verificarCorrente(s.id);
  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${corrente.integra ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
        {corrente.integra ? <ShieldCheck className="h-5 w-5" aria-hidden="true" /> : <ShieldAlert className="h-5 w-5" aria-hidden="true" />}
        {corrente.integra
          ? `Corrente de auditoria íntegra: ${corrente.total} eventos, cada um amarrado ao anterior por hash.`
          : `ATENÇÃO: a corrente quebra no evento ${corrente.quebraEm! + 1} de ${corrente.total}. Algum registro foi alterado ou apagado direto no banco.`}
        <Link href={`/api/admin/sorteios/${s.id}/exportar?tipo=auditoria`} prefetch={false} className="ml-auto text-xs font-medium underline">
          Exportar
        </Link>
      </div>
      <ol className="space-y-2">
        {s.eventos.map((e) => (
          <li key={e.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-[#07366A]">{e.descricao}</span>
              <span className="text-xs text-gray-400">
                {dataHoraBR(e.ocorridoEm)} · {e.atorNome}
              </span>
            </div>
            {e.justificativa && <p className="mt-1 text-xs text-gray-600">Justificativa: {e.justificativa}</p>}
            <p className="mt-1 font-mono text-[10px] text-gray-400">
              {e.tipo} · {e.hash.slice(0, 16)}…
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
