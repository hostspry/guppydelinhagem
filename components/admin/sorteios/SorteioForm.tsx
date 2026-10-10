"use client";

import { useActionState, useState, useTransition } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { salvarSorteioAction, uploadImagemSorteio } from "@/actions/sorteios";

export type ValoresSorteio = {
  nome: string;
  slug: string;
  organizador: string;
  eventoOrigem: string;
  dataEvento: string;
  premio: string;
  descricao: string;
  regras: string;
  imagemUrl: string;
  transmissaoUrl: string;
  dataSorteio: string;
  publico: boolean;
  modoSorteio: "ELETRONICO" | "LOTERIA_FEDERAL";
  concursoLoteria: string;
};

const input =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#07366A] focus:outline-none focus:ring-1 focus:ring-[#07366A]";

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SorteioForm({
  id,
  inicial,
  travado,
}: {
  id: string | null;
  inicial: ValoresSorteio;
  /** Lista homologada: modo e concurso não mudam mais. */
  travado: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(salvarSorteioAction.bind(null, id), null);
  const [v, setV] = useState(inicial);
  const [slugManual, setSlugManual] = useState(!!id);
  const [subindo, iniciarUpload] = useTransition();
  const [erroImg, setErroImg] = useState<string | null>(null);
  const erros = estado && !estado.ok ? (estado.campos ?? {}) : {};

  const set = <K extends keyof ValoresSorteio>(k: K, val: ValoresSorteio[K]) => setV((x) => ({ ...x, [k]: val }));

  function subir(file: File) {
    setErroImg(null);
    const fd = new FormData();
    fd.set("file", file);
    iniciarUpload(async () => {
      const r = await uploadImagemSorteio(fd);
      if (r.ok) set("imagemUrl", r.url);
      else setErroImg(r.erro);
    });
  }

  return (
    <form action={enviar} className="space-y-6">
      {estado && !estado.ok && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{estado.erro}</p>
      )}

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-[#07366A]">Sorteio</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" erro={erros.nome}>
            <input
              name="nome"
              className={input}
              value={v.nome}
              onChange={(e) => {
                set("nome", e.target.value);
                if (!slugManual) set("slug", slugify(e.target.value));
              }}
              required
            />
          </Campo>
          <Campo rotulo="Endereço (slug)" erro={erros.slug} ajuda={`/sorteios/${v.slug || "…"}`}>
            <input
              name="slug"
              className={input}
              value={v.slug}
              onChange={(e) => {
                setSlugManual(true);
                set("slug", e.target.value);
              }}
              required
            />
          </Campo>
          <Campo rotulo="Organizador" erro={erros.organizador}>
            <input name="organizador" className={input} value={v.organizador} onChange={(e) => set("organizador", e.target.value)} required />
          </Campo>
          <Campo rotulo="Evento de origem" erro={erros.eventoOrigem}>
            <input name="eventoOrigem" className={input} value={v.eventoOrigem} onChange={(e) => set("eventoOrigem", e.target.value)} placeholder="Leilão ao vivo pelo WhatsApp" />
          </Campo>
          <Campo rotulo="Data do evento" erro={erros.dataEvento}>
            <input type="date" name="dataEvento" className={input} value={v.dataEvento} onChange={(e) => set("dataEvento", e.target.value)} />
          </Campo>
          <Campo rotulo="Data e hora do sorteio" erro={erros.dataSorteio} ajuda="Horário de Brasília">
            <input type="datetime-local" name="dataSorteio" className={input} value={v.dataSorteio} onChange={(e) => set("dataSorteio", e.target.value)} />
          </Campo>
          <Campo rotulo="Link da transmissão" erro={erros.transmissaoUrl}>
            <input name="transmissaoUrl" className={input} value={v.transmissaoUrl} onChange={(e) => set("transmissaoUrl", e.target.value)} placeholder="https://instagram.com/…" />
          </Campo>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-[#07366A]">Prêmio</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <div className="space-y-4">
            <Campo rotulo="Prêmio" erro={erros.premio}>
              <input name="premio" className={input} value={v.premio} onChange={(e) => set("premio", e.target.value)} required />
            </Campo>
            <Campo rotulo="Descrição" erro={erros.descricao}>
              <textarea name="descricao" rows={3} className={input} value={v.descricao} onChange={(e) => set("descricao", e.target.value)} />
            </Campo>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">Imagem do prêmio</span>
            <label className="relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-[#07366A]">
              {v.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.imagemUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : subindo ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <ImageUp className="h-7 w-7" />
              )}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
            </label>
            <input type="hidden" name="imagemUrl" value={v.imagemUrl} />
            {v.imagemUrl && (
              <button type="button" className="mt-1 text-xs text-gray-500 hover:text-red-600" onClick={() => set("imagemUrl", "")}>
                Remover imagem
              </button>
            )}
            {erroImg && <p className="mt-1 text-xs text-red-600">{erroImg}</p>}
          </div>
        </div>
        <Campo rotulo="Regras (aparecem na página pública)" erro={erros.regras}>
          <textarea name="regras" rows={6} className={input} value={v.regras} onChange={(e) => set("regras", e.target.value)} />
        </Campo>
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-[#07366A]">Como o vencedor é escolhido</h2>
        {travado && <p className="text-xs text-amber-700">A lista está homologada: o modo e o concurso ficaram fixos.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["ELETRONICO", "Sorteio eletrônico", "O servidor escolhe o bilhete com gerador criptográfico. Bom para ensaio e sorteio interno."],
              ["LOTERIA_FEDERAL", "Loteria Federal", "O bilhete sai do resultado oficial da Caixa. É o caminho aceito em promoção autorizada pela SPA/MF."],
            ] as const
          ).map(([valor, titulo, texto]) => (
            <label key={valor} className={`flex gap-3 rounded-lg border p-3 text-sm ${v.modoSorteio === valor ? "border-[#07366A] bg-blue-50/50" : "border-gray-200"} ${travado ? "opacity-60" : "cursor-pointer"}`}>
              <input type="radio" name="modoSorteio" value={valor} checked={v.modoSorteio === valor} disabled={travado} onChange={() => set("modoSorteio", valor)} className="mt-1" />
              <span>
                <span className="block font-medium text-[#07366A]">{titulo}</span>
                <span className="text-xs text-gray-500">{texto}</span>
              </span>
            </label>
          ))}
        </div>
        {travado && <input type="hidden" name="modoSorteio" value={v.modoSorteio} />}
        {v.modoSorteio === "LOTERIA_FEDERAL" && (
          <Campo rotulo="Concurso da Loteria Federal" erro={erros.concursoLoteria} ajuda="Precisa estar definido antes de homologar. Entra no hash da lista.">
            <input name="concursoLoteria" className={input} value={v.concursoLoteria} readOnly={travado} onChange={(e) => set("concursoLoteria", e.target.value)} placeholder="Ex.: 6012" />
          </Campo>
        )}
        {v.modoSorteio !== "LOTERIA_FEDERAL" && <input type="hidden" name="concursoLoteria" value="" />}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="publico" checked={v.publico} onChange={(e) => set("publico", e.target.checked)} className="mt-1" />
          <span>
            <span className="font-medium text-[#07366A]">Mostrar na página pública /sorteios</span>
            <span className="block text-xs text-gray-500">
              Só os dados do sorteio, o total de bilhetes e o nome público do vencedor. Bilhetes e telefones de cada pessoa continuam privados.
              Antes de divulgar, confira a autorização da promoção.
            </span>
          </span>
        </label>
      </section>

      <div className="flex justify-end">
        <button disabled={enviando || subindo} className="inline-flex items-center gap-2 rounded-md bg-[#FF035C] px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60">
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
          {id ? "Salvar" : "Criar sorteio"}
        </button>
      </div>
    </form>
  );
}

function Campo({ rotulo, erro, ajuda, children }: { rotulo: string; erro?: string[]; ajuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{rotulo}</span>
      {children}
      {ajuda && !erro && <span className="mt-1 block text-xs text-gray-400">{ajuda}</span>}
      {erro && <span className="mt-1 block text-xs text-red-600">{erro[0]}</span>}
    </label>
  );
}
