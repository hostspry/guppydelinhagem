"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Play, FlaskConical, RotateCcw } from "lucide-react";
import { Roleta, type ResultadoApresentado } from "@/components/sorteios/Roleta";
import { ensaioSorteioAction, realizarSorteioAction } from "@/actions/sorteios";
import type { DadosRoleta } from "@/lib/queries/sorteios";

/**
 * Controles da equipe em volta da roleta. O botão chama o servidor, que
 * sorteia e grava; só depois a roleta recebe o número e começa a girar.
 */
export function RoletaAdmin({ dados }: { dados: DadosRoleta }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [apresentar, setApresentar] = useState<(ResultadoApresentado & { chave: number }) | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [premios, setPremios] = useState(["", "", "", "", ""]);
  const [realizado, setRealizado] = useState(dados.resultado);
  const loteria = dados.modoSorteio === "LOTERIA_FEDERAL";
  const podeSortear = dados.status === "HOMOLOGADO" && !realizado;
  const podeEnsaiar = dados.status === "CONFERENCIA" || dados.status === "HOMOLOGADO";

  function sortear() {
    iniciar(async () => {
      const r = await realizarSorteioAction(dados.id, palavra, loteria ? premios : undefined);
      if (!r.ok) return void toast.error(r.erro);
      setConfirmando(false);
      setPalavra("");
      setRealizado({ bilhete: r.dados.bilhete, vencedorPublico: r.dados.vencedorPublico, realizadoEm: new Date().toISOString() });
      setApresentar({ bilhete: r.dados.bilhete, vencedorPublico: r.dados.vencedorPublico, chave: Date.now() });
    });
  }

  function ensaio() {
    iniciar(async () => {
      const r = await ensaioSorteioAction(dados.id);
      if (!r.ok) return void toast.error(r.erro);
      setApresentar({ bilhete: r.dados.bilhete, vencedorPublico: r.dados.vencedorPublico, ensaio: true, chave: Date.now() });
    });
  }

  const rodape = (
    <div className="space-y-3">
      {podeSortear && !confirmando && (
        <button type="button" onClick={() => setConfirmando(true)} disabled={pendente} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#FF035C] to-[#87002F] px-6 py-4 text-lg font-semibold shadow-lg hover:brightness-110 disabled:opacity-60">
          <Play className="h-5 w-5" /> Sortear
        </button>
      )}
      {podeSortear && confirmando && (
        <div className="space-y-2 rounded-xl bg-white p-4 text-left text-[#302F2F]">
          <p className="text-sm font-semibold text-[#07366A]">Sorteio oficial</p>
          <p className="text-xs text-gray-600">O resultado é definitivo e fica gravado. Não existe sortear de novo.</p>
          {loteria && (
            <div className="space-y-1">
              <p className="text-xs text-gray-600">Resultado da Loteria Federal, concurso {dados.concursoLoteria}:</p>
              {premios.map((p, i) => (
                <input key={i} value={p} onChange={(e) => setPremios((x) => x.map((y, j) => (j === i ? e.target.value : y)))} placeholder={`${i + 1}º prêmio`} className="w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm" />
              ))}
            </div>
          )}
          <input value={palavra} onChange={(e) => setPalavra(e.target.value)} placeholder="Digite SORTEAR" className="w-full rounded border border-gray-300 px-2 py-2 font-mono text-sm uppercase" autoFocus />
          <div className="flex gap-2">
            <button type="button" onClick={sortear} disabled={pendente || palavra.trim().toUpperCase() !== "SORTEAR" || (loteria && !premios[0].trim())} className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[#FF035C] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {pendente && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar e girar
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
              Voltar
            </button>
          </div>
        </div>
      )}
      {!podeSortear && !realizado && dados.status === "CONFERENCIA" && (
        <p className="rounded-lg bg-white/10 p-3 text-sm text-white/80">A lista ainda não foi homologada. Só dá para ensaiar.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {podeEnsaiar && (
          <button type="button" onClick={ensaio} disabled={pendente} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm ring-1 ring-white/25 hover:bg-white/20 disabled:opacity-50">
            <FlaskConical className="h-4 w-4" /> Ensaio (sem valor)
          </button>
        )}
        {realizado && (
          <button type="button" onClick={() => setApresentar({ ...realizado, chave: Date.now() })} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm ring-1 ring-white/25 hover:bg-white/20">
            <RotateCcw className="h-4 w-4" /> Rever animação
          </button>
        )}
      </div>
      {dados.hashLista && <p className="break-all font-mono text-[10px] text-white/45">Lista SHA-256 {dados.hashLista}</p>}
    </div>
  );

  return (
    <Roleta
      fatias={dados.fatias}
      total={dados.total}
      premio={dados.premio}
      imagemUrl={dados.imagemUrl}
      resultadoInicial={dados.resultado}
      apresentar={apresentar}
      onConcluir={(r) => !r.ensaio && router.refresh()}
      rodape={rodape}
    />
  );
}
