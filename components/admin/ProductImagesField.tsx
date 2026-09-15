"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from "lucide-react";
import { uploadProductImage } from "@/actions/upload";

/** url = versão do site (até 100 KB); urlAlta = versão do Mercado Livre. */
export type ImagemDraft = { url: string; urlAlta?: string | null; alt: string };

const MAX = 8;

/**
 * Fotos do produto. Vale para qualquer tipo: peixe também tem foto, produto
 * também tem vídeo.
 *
 * A capa da vitrine é a miniatura do vídeo quando existe vídeo; senão, a
 * primeira foto daqui. Sem nenhum dos dois, o produto aparece como um
 * retângulo cinza — daí o aviso.
 */
export function ProductImagesField({
  value,
  onChange,
  semVideo,
}: {
  value: ImagemDraft[];
  onChange: (v: ImagemDraft[]) => void;
  /** Sem vídeo cadastrado, a foto é a única imagem que o produto terá. */
  semVideo?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function enviar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (arquivos.length === 0) return;

    const cabem = MAX - value.length;
    if (cabem <= 0) {
      toast.error(`Máximo de ${MAX} fotos.`);
      return;
    }
    const lote = arquivos.slice(0, cabem);
    if (lote.length < arquivos.length) {
      toast.warning(`Só couberam ${lote.length}: o limite é ${MAX} fotos.`);
    }

    setEnviando(true);
    try {
      const novas: ImagemDraft[] = [];
      let kbAntes = 0;
      let kbDepois = 0;
      for (const file of lote) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await uploadProductImage(fd);
        if (!res.ok) {
          toast.error(`${file.name}: ${res.error}`);
          continue;
        }
        novas.push({ url: res.url, urlAlta: res.urlAlta, alt: "" });
        kbAntes += res.info.kbAntes;
        kbDepois += res.info.kbSite;
        // Aviso por foto: é na hora de subir que dá para trocar por uma melhor.
        if (res.info.avisos.length > 0) {
          const tamanho = res.info.largura ? ` (${res.info.largura}x${res.info.altura})` : "";
          toast.warning(`${file.name}${tamanho}: ${res.info.avisos.join("; ")}.`, {
            duration: 10_000,
          });
        }
      }
      if (novas.length > 0) {
        onChange([...value, ...novas]);
        const kb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(1)} MB` : `${n} KB`);
        toast.success(
          `${novas.length} foto(s) otimizada(s) para o site: ${kb(kbAntes)} → ${kb(kbDepois)}, sem perda visível. O Mercado Livre recebe a versão em alta. Salve o produto para gravar.`,
          { duration: 8000 },
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  function remover(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function mover(i: number, dir: -1 | 1) {
    const destino = i + dir;
    if (destino < 0 || destino >= value.length) return;
    const copia = [...value];
    [copia[i], copia[destino]] = [copia[destino], copia[i]];
    onChange(copia);
  }

  function alt(i: number, texto: string) {
    onChange(value.map((img, idx) => (idx === i ? { ...img, alt: texto } : img)));
  }

  return (
    <fieldset className="bg-white border border-gray-200 rounded-lg p-5">
      <legend className="px-2 text-xs font-semibold text-[#07366A] uppercase tracking-wide">
        Fotos
      </legend>

      <p className="text-xs text-gray-500 mb-3">
        Use as setas para trocar a ordem. JPG, PNG ou WebP, até 9 MB cada. Não precisa
        otimizar antes: o site grava uma versão de até 100 KB para a loja e outra em alta
        para o Mercado Livre, e tira o GPS da foto. Para o ML, prefira foto quadrada com
        mais de 800 px.
        {semVideo ? (
          <>
            {" "}
            <strong className="text-[#07366A]">
              Sem vídeo cadastrado, a primeira foto é a capa na vitrine.
            </strong>{" "}
            Sem foto nenhuma, o produto aparece sem imagem.
          </>
        ) : (
          <>
            {" "}
            Como já existe vídeo, a capa da vitrine continua sendo a miniatura
            dele; estas fotos aparecem na página do produto.
          </>
        )}
      </p>

      {value.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {value.map((img, i) => (
            <li
              key={`${img.url}-${i}`}
              className={`rounded-md border p-2 ${
                i === 0 ? "border-2 border-[#0EA5E9]" : "border-gray-200"
              }`}
            >
              <div className="relative aspect-square bg-gray-100 rounded overflow-hidden mb-2">
                <Image
                  src={img.url}
                  alt={img.alt || "Foto do produto"}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {i === 0 && (
                  <span className="absolute top-1 left-1 bg-[#0EA5E9] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    capa
                  </span>
                )}
              </div>

              <input
                value={img.alt}
                onChange={(e) => alt(i, e.target.value)}
                placeholder="Descreva a foto (acessibilidade)"
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-1.5"
              />

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label="Mover para trás"
                    className="p-1 text-gray-500 hover:text-[#07366A] disabled:opacity-30"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === value.length - 1}
                    aria-label="Mover para frente"
                    className="p-1 text-gray-500 hover:text-[#07366A] disabled:opacity-30"
                  >
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remover(i)}
                  aria-label="Remover foto"
                  className="p-1 text-gray-500 hover:text-[#FF035C]"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={enviar}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={enviando || value.length >= MAX}
        className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all disabled:opacity-60"
      >
        <ImagePlus className="w-4 h-4" aria-hidden="true" />
        {enviando
          ? "Enviando..."
          : value.length === 0
            ? "Adicionar fotos"
            : `Adicionar mais (${value.length}/${MAX})`}
      </button>
    </fieldset>
  );
}
