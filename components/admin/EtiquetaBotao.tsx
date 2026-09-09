"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Tag } from "lucide-react";
import {
  cotarEtiquetaDoPedido,
  comprarEtiquetaDoPedido,
  type OpcaoEtiqueta,
} from "@/actions/etiqueta";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Compra de etiqueta em dois passos.
 *
 * O primeiro botão só cota (não gasta nada) e mostra preço e prazo. O débito do
 * saldo do Melhor Envio acontece apenas no segundo, que diz o valor no próprio
 * rótulo — dinheiro saindo nunca deve ser efeito colateral de um clique.
 */
export function EtiquetaBotao({
  orderId,
  etiquetaUrl,
  podeComprar,
  motivo,
}: {
  orderId: string;
  /** Já comprada: mostra o PDF em vez de oferecer comprar de novo. */
  etiquetaUrl: string | null;
  podeComprar: boolean;
  /** Por que não pode, quando não pode. */
  motivo?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [opcoes, setOpcoes] = useState<OpcaoEtiqueta[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [comprando, setComprando] = useState(false);

  if (etiquetaUrl) {
    return (
      <a
        href={etiquetaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all"
      >
        <FileText className="w-4 h-4" aria-hidden="true" />
        Ver etiqueta (PDF)
      </a>
    );
  }

  if (!podeComprar) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-gray-500">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        {motivo ?? "Etiqueta disponível só para pedido pago."}
      </p>
    );
  }

  function cotar() {
    startTransition(async () => {
      const r = await cotarEtiquetaDoPedido(orderId);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setOpcoes(r.opcoes);
      setAviso(r.aviso ?? null);
      setEscolhido(r.opcoes[0]?.servicoId ?? null);
    });
  }

  function comprar() {
    if (escolhido == null) return;
    setComprando(true);
    startTransition(async () => {
      const r = await comprarEtiquetaDoPedido(orderId, escolhido);
      setComprando(false);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Etiqueta comprada.");
      router.refresh();
    });
  }

  const opcao = opcoes?.find((o) => o.servicoId === escolhido) ?? null;

  return (
    <div className="space-y-3">
      {!opcoes && (
        <button
          type="button"
          onClick={cotar}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Tag className="w-4 h-4" aria-hidden="true" />
          )}
          Gerar etiqueta
        </button>
      )}

      {opcoes && (
        <div className="rounded-md border border-gray-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-[#07366A]">
            Escolha o serviço. Só o botão de comprar debita o saldo.
          </p>

          {aviso && <p className="text-xs text-gray-500">{aviso}</p>}

          {opcoes.length === 0 && (
            <p className="text-xs text-gray-500">
              Nenhuma transportadora atende esse CEP.
            </p>
          )}

          {opcoes.map((o, i) => (
            <label
              key={o.servicoId}
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
            >
              <input
                type="radio"
                name="servicoEtiqueta"
                checked={escolhido === o.servicoId}
                onChange={() => setEscolhido(o.servicoId)}
                className="accent-[#FF035C]"
              />
              <span className="flex-1">
                {o.label}
                <span className="block text-xs text-gray-500">
                  {o.prazoDias} dias úteis
                  {opcoes.length > 1
                    ? i === 0
                      ? " · mais barato"
                      : " · mais rápido"
                    : ""}
                </span>
              </span>
              <span className="font-bold text-[#07366A]">{brl.format(o.preco)}</span>
            </label>
          ))}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={comprar}
              disabled={escolhido == null || comprando || isPending}
              className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 transition-all disabled:opacity-60"
            >
              {comprando ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Tag className="w-4 h-4" aria-hidden="true" />
              )}
              {opcao
                ? `Comprar etiqueta — ${brl.format(opcao.preco)}`
                : "Comprar etiqueta"}
            </button>
            <button
              type="button"
              onClick={() => setOpcoes(null)}
              className="border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-gray-400 transition-all"
            >
              Cancelar
            </button>
          </div>

          <p className="text-[11px] text-amber-800 leading-snug">
            Esse valor sai do saldo do Melhor Envio na hora e não tem desfazer
            por aqui: cancelamento é pelo site deles, dentro do prazo.
          </p>
        </div>
      )}
    </div>
  );
}
