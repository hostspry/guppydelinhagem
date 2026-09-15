"use client";

import { useRef, useState, useTransition } from "react";
import { ClipboardPaste, ImageIcon, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { avisarErroIa } from "@/lib/ai/avisar-erro";
import { lerConversaVenda, type LeituraConversaResult } from "@/actions/venda-whatsapp";

type LeituraOk = Extract<LeituraConversaResult, { ok: true }>;

const MAX_PRINTS = 6;
const LADO_MAX = 2400;

/**
 * Print de celular chega com 2 a 4 MB. Reduzido para JPEG ele continua legível
 * e cabe no limite da action, além de sair mais barato na IA. HEIC o navegador
 * não desenha, então vai como veio.
 */
async function reduzir(f: File): Promise<File> {
  if (/heic|heif/.test(f.type) || f.size < 900_000) return f;
  try {
    const bmp = await createImageBitmap(f);
    const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], f.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : f;
  } catch {
    return f;
  }
}

/**
 * Colar a conversa (ou mandar prints) → pedido preenchido para conferir.
 *
 * Duas leituras: com IA, que entende a conversa inteira e acha os produtos no
 * catálogo; e sem IA, só dos dados do cliente, grátis e na hora.
 */
export function LeitorConversa({
  onLido,
  onLidoSemIa,
}: {
  onLido: (r: LeituraOk) => void;
  onLidoSemIa: (texto: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");
  const [prints, setPrints] = useState<File[]>([]);
  const inputFile = useRef<HTMLInputElement>(null);

  function adicionarPrints(lista: FileList | null) {
    if (!lista) return;
    const novos = [...prints, ...Array.from(lista)].slice(0, MAX_PRINTS);
    if (prints.length + lista.length > MAX_PRINTS) {
      toast.error(`No máximo ${MAX_PRINTS} prints por leitura.`);
    }
    setPrints(novos);
    if (inputFile.current) inputFile.current.value = "";
  }

  function lerComIa() {
    if (!prints.length && texto.trim().length < 10) {
      toast.error("Cole a conversa ou escolha os prints.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      if (texto.trim()) fd.append("texto", texto.trim());
      for (const p of await Promise.all(prints.map(reduzir))) fd.append("prints", p);

      const r = await lerConversaVenda(fd);
      if (!r.ok) {
        avisarErroIa(r.error);
        return;
      }
      onLido(r);
    });
  }

  return (
    <div className="bg-[#07366A]/[0.03] border border-[#07366A]/10 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-[#FAB82A]" aria-hidden="true" />
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Ler a conversa
        </h2>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Cole a conversa do WhatsApp ou mande os prints. Eu preencho o cliente, os
        itens do catálogo e os valores para você conferir. Nada é salvo sozinho.
      </p>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={7}
        placeholder={`Pode colar a conversa inteira ou só o bloco de dados:\n\nQuero 2 trios do Koi Tuxedo, fica 300 com o frete?\nNome: Raul Moreira Castro Junior\nCPF: 172.160.938-52\nRua Quintino Bocaiuva, 1203\nJardim Paraíso, Bebedouro SP\nCep 14701-470`}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-mono leading-relaxed focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C] bg-white"
      />

      {prints.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mt-2">
          {prints.map((p, i) => (
            <li
              key={`${p.name}-${i}`}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-md px-2 py-1 max-w-[14rem]"
            >
              <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{p.name}</span>
              <button
                type="button"
                onClick={() => setPrints((a) => a.filter((_, x) => x !== i))}
                aria-label="Tirar este print"
                className="text-gray-400 hover:text-[#FF035C]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <input
          ref={inputFile}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => adicionarPrints(e.target.files)}
        />
        <button
          type="button"
          onClick={lerComIa}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#07366A] text-white text-sm font-medium rounded-md hover:brightness-125 disabled:opacity-50 transition-all"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Lendo…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Ler e preencher
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => inputFile.current?.click()}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white text-sm text-gray-700 rounded-md hover:border-gray-400"
        >
          <ImageIcon className="w-4 h-4" aria-hidden="true" />
          {prints.length ? "Mais prints" : "Prints da conversa"}
        </button>
        <button
          type="button"
          onClick={() => onLidoSemIa(texto)}
          disabled={isPending || !texto.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 rounded-md hover:text-[#07366A] disabled:opacity-40"
          title="Lê só os dados do cliente, sem gastar IA. Os itens você escolhe."
        >
          <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
          Só os dados do cliente, sem IA
        </button>
      </div>
    </div>
  );
}
