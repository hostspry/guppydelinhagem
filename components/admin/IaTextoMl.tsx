"use client";

import { useState, useTransition } from "react";
import { avisarErroIa } from "@/lib/ai/avisar-erro";
import { Sparkles, SpellCheck } from "lucide-react";
import {
  iaSugerirTitulosMl,
  iaMelhorarDescricaoMl,
  iaRevisarTextoMl,
} from "@/actions/mercadolivre-ia";
import {
  diffPalavras,
  problemasTitulo,
  termosNoTitulo,
  TITULO_MAX_ML,
} from "@/lib/mercadolivre/texto-ml";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

/**
 * Botões de IA dos textos do anúncio do ML. Nenhum grava nada: a sugestão vai
 * para o campo, e quem salva é o botão de salvar de sempre.
 */

const botaoIa =
  "inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-violet-200 bg-violet-50 text-[11px] font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50";

/** Diferença palavra a palavra: o que saiu riscado, o que entrou marcado. */
export function DiffTexto({ antes, depois }: { antes: string; depois: string }) {
  const pedacos = diffPalavras(antes, depois);
  return (
    <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700">
      {pedacos.map((p, i) =>
        p.tipo === "igual" ? (
          <span key={i}>{p.texto}</span>
        ) : p.tipo === "saiu" ? (
          <del key={i} className="bg-red-100 text-red-800">
            {p.texto}
          </del>
        ) : (
          <ins key={i} className="bg-green-100 text-green-900 no-underline">
            {p.texto}
          </ins>
        ),
      )}
    </p>
  );
}

/** Termos de busca cobertos e problemas do título, enquanto se digita. */
export function AvisosTitulo({
  titulo,
  composicao,
}: {
  titulo: string;
  composicao: TipoComposicao | null;
}) {
  const termos = termosNoTitulo(titulo);
  // Repetido com outro anúncio o servidor confere; aqui só o que dá para ver.
  const problemas = problemasTitulo(titulo, { composicao });
  return (
    <div className="mt-1 space-y-0.5 text-[11px]">
      <p className="text-gray-500">
        Termos de busca: {termos.length ? termos.join(", ") : "nenhum dos mais buscados"}
      </p>
      {problemas.length > 0 && (
        <p className="text-amber-700">O ML pode recusar: {problemas.join(", ")}.</p>
      )}
    </div>
  );
}

export function SugerirTitulos({
  productId,
  composicao,
  anuncioId,
  onUsar,
  disabled,
}: {
  productId: string;
  composicao: TipoComposicao | null;
  anuncioId?: string;
  onUsar: (titulo: string) => void;
  disabled?: boolean;
}) {
  const [opcoes, setOpcoes] = useState<
    { titulo: string; caracteres: number; termos: string[] }[] | null
  >(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await iaSugerirTitulosMl({ productId, composicao, anuncioId });
            if (!r.ok) {
              avisarErroIa(r.erro);
              return;
            }
            setOpcoes(r.opcoes);
          })
        }
        className={botaoIa}
      >
        <Sparkles size={12} aria-hidden="true" />
        {pending ? "Pensando…" : "Sugerir títulos com IA"}
      </button>
      {opcoes && (
        <ul className="mt-2 space-y-1.5">
          {opcoes.map((o) => (
            <li
              key={o.titulo}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-violet-100 bg-violet-50/50 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#07366A] break-words">{o.titulo}</p>
                <p className="text-[11px] text-gray-500">
                  {o.caracteres}/{TITULO_MAX_ML} · {o.termos.join(", ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onUsar(o.titulo);
                  setOpcoes(null);
                }}
                className="shrink-0 text-xs font-semibold text-violet-800 hover:underline"
              >
                Usar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Proposta de texto novo, lado a lado com o atual, para aceitar ou descartar. */
function Proposta({
  antes,
  depois,
  titulo,
  onUsar,
  onDescartar,
}: {
  antes: string;
  depois: string;
  titulo: string;
  onUsar: () => void;
  onDescartar: () => void;
}) {
  return (
    <div className="mt-2 rounded-md border border-violet-200 bg-white p-3 space-y-2">
      <p className="text-[11px] font-semibold text-violet-800">{titulo}</p>
      {antes.trim() === depois.trim() ? (
        <p className="text-xs text-gray-600">Nada a mudar.</p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <DiffTexto antes={antes} depois={depois} />
        </div>
      )}
      <div className="flex gap-2">
        {antes.trim() !== depois.trim() && (
          <button
            type="button"
            onClick={onUsar}
            className="px-3 py-1 rounded-md bg-violet-700 text-white text-xs font-semibold hover:brightness-110"
          >
            Usar esta versão
          </button>
        )}
        <button
          type="button"
          onClick={onDescartar}
          className="px-3 py-1 rounded-md border border-gray-300 text-xs text-gray-700"
        >
          {antes.trim() === depois.trim() ? "Fechar" : "Descartar"}
        </button>
      </div>
    </div>
  );
}

export function RevisarTexto({
  texto,
  tipo,
  onAplicar,
  disabled,
}: {
  texto: string;
  tipo: "titulo" | "descricao";
  onAplicar: (texto: string) => void;
  disabled?: boolean;
}) {
  const [proposta, setProposta] = useState<{ antes: string; depois: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={disabled || pending || texto.trim().length < 5}
        onClick={() =>
          start(async () => {
            const r = await iaRevisarTextoMl({ texto, tipo });
            if (!r.ok) {
              avisarErroIa(r.erro);
              return;
            }
            setProposta({ antes: texto, depois: r.texto });
          })
        }
        className={botaoIa}
      >
        <SpellCheck size={12} aria-hidden="true" />
        {pending ? "Revisando…" : "Revisar ortografia"}
      </button>
      {proposta && (
        <Proposta
          antes={proposta.antes}
          depois={proposta.depois}
          titulo="Revisão (só ortografia, acento e pontuação)"
          onUsar={() => {
            onAplicar(proposta.depois);
            setProposta(null);
          }}
          onDescartar={() => setProposta(null)}
        />
      )}
    </>
  );
}

export function MelhorarDescricao({
  productId,
  composicao,
  atual,
  onUsar,
  disabled,
}: {
  productId: string;
  composicao: TipoComposicao | null;
  atual: string;
  onUsar: (texto: string) => void;
  disabled?: boolean;
}) {
  const [proposta, setProposta] = useState<{ antes: string; depois: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await iaMelhorarDescricaoMl({ productId, composicao });
            if (!r.ok) {
              avisarErroIa(r.erro);
              return;
            }
            setProposta({ antes: atual, depois: r.descricao });
          })
        }
        className={botaoIa}
      >
        <Sparkles size={12} aria-hidden="true" />
        {pending ? "Escrevendo…" : "Melhorar descrição com IA"}
      </button>
      {proposta && (
        <Proposta
          antes={proposta.antes}
          depois={proposta.depois}
          titulo="Descrição sugerida (envio, licença e regra da segunda continuam iguais)"
          onUsar={() => {
            onUsar(proposta.depois);
            setProposta(null);
          }}
          onDescartar={() => setProposta(null)}
        />
      )}
    </>
  );
}
