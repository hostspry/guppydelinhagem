"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { lerComprovanteEnviado } from "@/actions/comprovante";
import type { ComprovanteLido } from "@/lib/ai/comprovante";

export type RascunhoLido = {
  dados: ComprovanteLido;
  comprovanteUrl: string | null;
  categoriaId: string | null;
};

const AVISO_CONFIANCA: Record<ComprovanteLido["confianca"], string> = {
  ALTA: "Leitura limpa. Ainda assim, confira o valor antes de salvar.",
  MEDIA: "Alguns campos foram deduzidos. Confira valor e data com atenção.",
  BAIXA: "Leitura difícil. Trate como rascunho e confira tudo.",
};

/**
 * Colar texto ou soltar um arquivo → rascunho preenchido no formulário.
 *
 * A IA nunca salva nada: ela devolve uma proposta que o dono confere. Por isso a
 * tela sempre mostra o quanto ela confiou na própria leitura.
 */
export function LeitorComprovante({
  onLido,
}: {
  onLido: (r: RascunhoLido) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [entreTitulares, setEntreTitulares] = useState(false);
  const inputFile = useRef<HTMLInputElement>(null);

  function enviar() {
    if (!arquivo && texto.trim().length < 10) {
      toast.error("Cole o texto do comprovante ou escolha um arquivo.");
      return;
    }

    const fd = new FormData();
    if (arquivo) fd.append("arquivo", arquivo);
    if (texto.trim()) fd.append("texto", texto.trim());

    startTransition(async () => {
      const r = await lerComprovanteEnviado(fd);

      if (!r.ok) {
        toast.error(r.error);
        // Mesmo sem leitura, o arquivo já subiu: mantém o anexo no lançamento
        // para o dono preencher à mão sem perder o comprovante.
        if (r.comprovanteUrl) {
          onLido({
            dados: {
              tipo: "SAIDA",
              valor: null,
              data: null,
              descricao: "",
              contraparte: null,
              categoriaSlug: null,
              observacoes: null,
              confianca: "BAIXA",
              aviso: null,
              entreTitulares: false,
            },
            comprovanteUrl: r.comprovanteUrl,
            categoriaId: null,
          });
          setAviso("Arquivo anexado, mas não consegui ler. Preencha à mão.");
        }
        return;
      }

      onLido({
        dados: r.dados,
        comprovanteUrl: r.comprovanteUrl,
        categoriaId: r.categoriaId,
      });
      setAviso(r.dados.aviso ?? AVISO_CONFIANCA[r.dados.confianca]);
      setEntreTitulares(r.dados.entreTitulares);
      toast.success("Comprovante lido. Confira os campos abaixo.");
    });
  }

  return (
    <div className="bg-[#07366A]/[0.03] border border-[#07366A]/10 rounded-lg p-4 mb-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-[#FAB82A]" aria-hidden="true" />
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Ler comprovante
        </h2>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Cole o texto do comprovante do banco ou envie o PDF/print. Os campos abaixo
        são preenchidos para você conferir — nada é salvo sozinho.
      </p>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        placeholder="Cole aqui o comprovante do Pix, o e-mail do boleto, a mensagem do banco…"
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C] bg-white"
      />

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <input
          ref={inputFile}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => inputFile.current?.click()}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white text-sm text-gray-700 rounded-md hover:border-gray-400"
        >
          <Upload className="w-4 h-4" aria-hidden="true" />
          {arquivo ? "Trocar arquivo" : "PDF ou imagem"}
        </button>

        {arquivo && (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-md px-2 py-1.5 max-w-[16rem]">
            <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{arquivo.name}</span>
            <button
              type="button"
              onClick={() => {
                setArquivo(null);
                if (inputFile.current) inputFile.current.value = "";
              }}
              aria-label="Remover arquivo"
              className="text-gray-400 hover:text-[#FF035C]"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </span>
        )}

        <button
          type="button"
          onClick={enviar}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#07366A] text-white text-sm font-medium rounded-md hover:brightness-125 disabled:opacity-50 transition-all"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Lendo…
            </>
          ) : (
            "Ler e preencher"
          )}
        </button>
      </div>

      {aviso && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mt-3">
          {aviso}
        </p>
      )}

      {/* Um sócio pagando o outro não dá para classificar sozinho: repasse de
          venda já lançada não mexe no caixa, retirada de sócio é saída de
          verdade. Só o motivo separa os dois, e errar aqui faz o dinheiro
          aparecer ou sumir do caixa. */}
      {entreTitulares && (
        <p className="text-xs text-[#FF035C] bg-[#FF035C]/5 border border-[#FF035C]/30 rounded px-3 py-2 mt-3">
          <strong className="font-semibold">Transferência entre vocês.</strong>{" "}
          Antes de salvar, diga no campo de descrição qual foi o motivo. Se for
          repasse de uma venda que já está no caixa, não lance de novo: o
          dinheiro já entrou e lançar a saída faz ele sumir. Lance só quando for
          retirada, pró-labore ou despesa que um pagou pelo outro.
        </p>
      )}
    </div>
  );
}
