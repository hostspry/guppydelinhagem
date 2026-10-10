"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import {
  aplicarChancesDosLancesAction,
  buscarContasAction,
  cancelarSorteioAction,
  cancelarVerificacaoAction,
  confirmarVerificacaoAction,
  corrigirChancesAction,
  decidirLanceAction,
  desvincularAction,
  homologarAction,
  importarLancesAction,
  importarParticipantesAction,
  informarTelefoneAction,
  retificarHomologacaoAction,
  vincularManualAction,
} from "@/actions/sorteios";

// Peças interativas do painel de sorteios. Cada uma chama uma action, mostra o
// resultado em toast e recarrega a tela (router.refresh) para os números baterem.

const input =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#07366A] focus:outline-none focus:ring-1 focus:ring-[#07366A]";
const botao =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 transition-colors";
export const botaoPrimario = `${botao} bg-[#07366A] text-white hover:bg-[#0E4C8F]`;
export const botaoCta = `${botao} bg-[#FF035C] text-white hover:brightness-110`;
export const botaoSecundario = `${botao} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;

type R = { ok: true; mensagem?: string } | { ok: false; erro: string };

function useAcao() {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  function rodar(fn: () => Promise<R>, sucesso?: string, depois?: () => void) {
    iniciar(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.mensagem ?? sucesso ?? "Feito.");
        depois?.();
        router.refresh();
      } else toast.error(r.erro);
    });
  }
  return { pendente, rodar };
}

// ── Importação ───────────────────────────────────────────────────────────────

export function ImportarForm({ sorteioId, tipo, jaTemDados }: { sorteioId: string; tipo: "participantes" | "lances"; jaTemDados: boolean }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [resumo, setResumo] = useState<string[] | null>(null);
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [justificativa, setJustificativa] = useState("");

  function enviar() {
    const fd = new FormData();
    if (arquivo) fd.set("arquivo", arquivo);
    fd.set("texto", texto);
    fd.set("justificativa", justificativa);
    iniciar(async () => {
      if (tipo === "participantes") {
        const r = await importarParticipantesAction(sorteioId, fd);
        if (!r.ok) return void toast.error(r.erro);
        const d = r.dados;
        setResumo([
          `${d.novos} novos, ${d.atualizados} alterados, ${d.iguais} sem mudança.`,
          d.vinculados ? `${d.vinculados} participante(s) ligados a contas com WhatsApp verificado.` : "",
          d.ausentes.length ? `Estão no sistema mas não vieram no arquivo (não foram apagados): ${d.ausentes.join(", ")}.` : "",
          ...d.avisos,
        ].filter(Boolean));
      } else {
        const r = await importarLancesAction(sorteioId, fd);
        if (!r.ok) return void toast.error(r.erro);
        const d = r.dados;
        setResumo([
          `${d.lidos} lances lidos: ${d.novos} novos, ${d.repetidos} já existiam.`,
          `No total: ${d.validos} válidos, ${d.invalidos} inválidos, ${d.revisar} para revisar.`,
          d.semParticipante ? `${d.semParticipante} lance(s) válido(s) sem participante correspondente na lista.` : "",
          ...d.avisos,
        ].filter(Boolean));
      }
      toast.success("Importação concluída.");
      setArquivo(null);
      setTexto("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 hover:border-[#07366A]">
        <Upload className="h-5 w-5 text-[#07366A]" />
        <span>{arquivo ? <strong>{arquivo.name}</strong> : "Escolher arquivo CSV (exportado do Excel ou Google Planilhas)"}</span>
        <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
      </label>
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500">ou colar o conteúdo</summary>
        <textarea rows={6} className={`${input} mt-2 font-mono text-xs`} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </details>
      {jaTemDados && tipo === "participantes" && (
        <input className={input} placeholder="Justificativa (obrigatória se a reimportação mudar alguma chance)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
      )}
      <button className={botaoPrimario} disabled={pendente || (!arquivo && !texto.trim())} onClick={enviar}>
        {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
        Importar
      </button>
      {resumo && (
        <ul className="space-y-1 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          {resumo.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Participante ─────────────────────────────────────────────────────────────

export function AcoesParticipante({
  sorteioId,
  p,
  editavel,
}: {
  sorteioId: string;
  p: {
    id: string;
    chances: number;
    telefone: string | null;
    userId: string | null;
    lancesValidos: number;
    lancesRevisar: number;
    pistas: { nome: string; userId: string | null; origem: string }[];
  };
  editavel: boolean;
}) {
  const { pendente, rodar } = useAcao();
  const [aberto, setAberto] = useState<null | "chances" | "telefone" | "vincular" | "desvincular" | "lances">(null);
  const [chances, setChances] = useState(p.chances);
  const [telefone, setTelefone] = useState("");
  const [just, setJust] = useState("");
  const [busca, setBusca] = useState("");
  const [contas, setContas] = useState<{ id: string; nome: string; email: string }[]>([]);
  const [conta, setConta] = useState<string | null>(null);

  const fechar = () => {
    setAberto(null);
    setJust("");
  };

  const opcoes: [typeof aberto, string, boolean][] = [
    ["chances", "Corrigir chances", editavel],
    ["lances", `Usar contagem dos lances (${p.lancesValidos})`, editavel && p.lancesValidos + p.lancesRevisar > 0 && p.lancesValidos !== p.chances],
    ["telefone", "Informar WhatsApp", editavel && !p.telefone],
    ["vincular", "Vincular a uma conta", !p.userId],
    ["desvincular", "Desfazer vínculo", !!p.userId],
  ];

  return (
    <div className="text-left">
      <div className="flex flex-wrap gap-1">
        {opcoes
          .filter(([, , ver]) => ver)
          .map(([k, rotulo]) => (
            <button key={k} type="button" onClick={() => setAberto(aberto === k ? null : k)} className={`rounded px-2 py-1 text-xs ${aberto === k ? "bg-[#07366A] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {rotulo}
            </button>
          ))}
      </div>
      {aberto && (
        <div className="mt-2 space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          {aberto === "chances" && <input type="number" min={0} className={input} value={chances} onChange={(e) => setChances(Number(e.target.value))} />}
          {aberto === "telefone" && <input className={input} placeholder="+55 21 99999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />}
          {aberto === "vincular" && (
            <div className="space-y-2">
              {p.pistas.filter((x) => x.userId).map((x) => (
                <button key={x.userId} type="button" onClick={() => setConta(x.userId)} className={`block w-full rounded border px-2 py-1 text-left text-xs ${conta === x.userId ? "border-[#07366A] bg-white" : "border-gray-200"}`}>
                  {x.nome} <span className="text-gray-400">· {x.origem}</span>
                </button>
              ))}
              <div className="flex gap-2">
                <input className={input} placeholder="Buscar conta por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <button type="button" className={botaoSecundario} onClick={async () => setContas(await buscarContasAction(busca))}>
                  Buscar
                </button>
              </div>
              {contas.map((c) => (
                <button key={c.id} type="button" onClick={() => setConta(c.id)} className={`block w-full rounded border px-2 py-1 text-left text-xs ${conta === c.id ? "border-[#07366A] bg-white" : "border-gray-200"}`}>
                  {c.nome} <span className="text-gray-400">· {c.email}</span>
                </button>
              ))}
              <p className="text-xs text-amber-700">Vínculo manual pula a verificação do WhatsApp. Use só quando tiver certeza de quem é.</p>
            </div>
          )}
          <input className={input} placeholder="Justificativa (obrigatória)" value={just} onChange={(e) => setJust(e.target.value)} />
          <div className="flex gap-2">
            <button
              type="button"
              className={botaoPrimario}
              disabled={pendente || just.trim().length < 5 || (aberto === "vincular" && !conta)}
              onClick={() => {
                const acoes = {
                  chances: () => corrigirChancesAction(sorteioId, p.id, chances, just),
                  lances: () => aplicarChancesDosLancesAction(sorteioId, p.id, just),
                  telefone: () => informarTelefoneAction(sorteioId, p.id, telefone, just),
                  vincular: () => vincularManualAction(sorteioId, p.id, conta!, just),
                  desvincular: () => desvincularAction(sorteioId, p.id, just),
                };
                rodar(acoes[aberto], "Salvo.", fechar);
              }}
            >
              {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar
            </button>
            <button type="button" className={botaoSecundario} onClick={fechar}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lance ────────────────────────────────────────────────────────────────────

export function DecidirLance({ sorteioId, lanceId }: { sorteioId: string; lanceId: string }) {
  const { pendente, rodar } = useAcao();
  const [just, setJust] = useState("");
  return (
    <div className="flex min-w-[260px] flex-col gap-1.5">
      <input className={`${input} py-1 text-xs`} placeholder="Justificativa" value={just} onChange={(e) => setJust(e.target.value)} />
      <div className="flex gap-1.5">
        <button type="button" disabled={pendente || just.trim().length < 5} className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40" onClick={() => rodar(() => decidirLanceAction(sorteioId, lanceId, "VALIDO", just), "Lance marcado como válido.")}>
          Válido
        </button>
        <button type="button" disabled={pendente || just.trim().length < 5} className="rounded bg-gray-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-40" onClick={() => rodar(() => decidirLanceAction(sorteioId, lanceId, "INVALIDO", just), "Lance marcado como inválido.")}>
          Inválido
        </button>
      </div>
    </div>
  );
}

// ── Homologação ──────────────────────────────────────────────────────────────

export function Homologar({ sorteioId, total, bloqueio }: { sorteioId: string; total: number; bloqueio: string | null }) {
  const { pendente, rodar } = useAcao();
  const [obs, setObs] = useState("");
  const [certeza, setCerteza] = useState(false);
  return (
    <div className="space-y-3">
      {bloqueio && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">{bloqueio}</p>}
      <textarea rows={2} className={input} placeholder="Observação da homologação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={certeza} onChange={(e) => setCerteza(e.target.checked)} className="mt-1" />
        <span>Conferi a lista. Os {total} bilhetes ficam congelados com hash SHA-256; mudar depois exige retificação registrada.</span>
      </label>
      <button
        type="button"
        className={botaoCta}
        disabled={pendente || !certeza || !!bloqueio}
        onClick={() => rodar(async () => {
          const r = await homologarAction(sorteioId, obs);
          return r.ok ? { ok: true, mensagem: `Homologado: ${r.dados.total} bilhetes.` } : r;
        })}
      >
        {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
        Homologar lista definitiva
      </button>
    </div>
  );
}

export function JustificativaBotao({
  rotulo,
  aviso,
  acao,
  perigo,
  sorteioId,
}: {
  rotulo: string;
  aviso: string;
  acao: "retificar" | "cancelar";
  perigo?: boolean;
  sorteioId: string;
}) {
  const { pendente, rodar } = useAcao();
  const [aberto, setAberto] = useState(false);
  const [just, setJust] = useState("");
  if (!aberto) {
    return (
      <button type="button" className={perigo ? `${botaoSecundario} text-red-600` : botaoSecundario} onClick={() => setAberto(true)}>
        {rotulo}
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs text-gray-600">{aviso}</p>
      <input className={input} placeholder="Justificativa (obrigatória)" value={just} onChange={(e) => setJust(e.target.value)} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pendente || just.trim().length < 5}
          className={perigo ? `${botaoCta} bg-red-600` : botaoPrimario}
          onClick={() => rodar(() => (acao === "retificar" ? retificarHomologacaoAction(sorteioId, just) : cancelarSorteioAction(sorteioId, just)), "Registrado.", () => setAberto(false))}
        >
          Confirmar
        </button>
        <button type="button" className={botaoSecundario} onClick={() => setAberto(false)}>
          Voltar
        </button>
      </div>
    </div>
  );
}

// ── Verificação de WhatsApp ──────────────────────────────────────────────────

export function ConfirmarVerificacao({ verificacaoId }: { verificacaoId: string }) {
  const { pendente, rodar } = useAcao();
  const [codigo, setCodigo] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className={`${input} w-40 font-mono uppercase`} placeholder="GDL-XXXXXX" value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-label="Código recebido" />
      <button type="button" className={botaoPrimario} disabled={pendente || codigo.replace(/\W/g, "").length < 6} onClick={() => rodar(() => confirmarVerificacaoAction(verificacaoId, codigo), undefined, () => setCodigo(""))}>
        {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
        Confirmar
      </button>
      <button type="button" className="text-xs text-gray-500 hover:text-red-600" disabled={pendente} onClick={() => rodar(() => cancelarVerificacaoAction(verificacaoId), "Pedido cancelado.")}>
        Recusar
      </button>
    </div>
  );
}
