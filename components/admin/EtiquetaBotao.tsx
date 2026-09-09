"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Mail,
  Package,
  RefreshCw,
  Tag,
} from "lucide-react";
import {
  cotarEtiquetaDoPedido,
  comprarEtiquetaDoPedido,
  salvarPacoteDoPedido,
  reenviarRastreio,
  atualizarRastreioDoPedido,
  type OpcaoEtiqueta,
  type PacoteCotado,
} from "@/actions/etiqueta";
import { ImprimirEtiqueta } from "@/components/admin/ImprimirEtiqueta";

/** Embalagens que a loja usa no dia a dia, para não digitar sempre. */
const PRESETS = [
  { nome: "Envelope", comprimento: 30, largura: 20, altura: 2 },
  { nome: "Caixa P", comprimento: 20, largura: 15, altura: 10 },
  { nome: "Caixa M", comprimento: 30, largura: 20, altura: 15 },
];

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
  const [pacote, setPacote] = useState<PacoteCotado | null>(null);
  const [editandoCaixa, setEditandoCaixa] = useState(false);
  const [caixa, setCaixa] = useState({
    comprimento: "",
    largura: "",
    altura: "",
    pesoGramas: "",
  });

  if (etiquetaUrl) {
    // Comprada. O e-mail com o rastreio já saiu sozinho aqui; o botão existe
    // porque e-mail some (spam, caixa cheia, cliente apagou sem ler).
    return (
      <div className="flex flex-wrap gap-2">
        <ImprimirEtiqueta orderId={orderId} />
        <a
          href={etiquetaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all"
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          Ver etiqueta (PDF)
        </a>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              const r = await reenviarRastreio(orderId);
              if (!r.success) toast.error(r.error);
              else toast.success(`Rastreio reenviado para ${r.para}.`);
            })
          }
          disabled={isPending}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all disabled:opacity-60"
        >
          <Mail className="w-4 h-4" aria-hidden="true" />
          Reenviar rastreio
        </button>
        {/* O cron já busca sozinho; o botão é para quem está com a caixa na
            mão e não vai esperar a próxima rodada. */}
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              const r = await atualizarRastreioDoPedido(orderId);
              if (!r.success) {
                toast.error(r.error);
                return;
              }
              toast.success(
                r.codigo
                  ? `Rastreio: ${r.codigo}${r.status ? ` (${r.status})` : ""}`
                  : "O Melhor Envio ainda não emitiu o código. Tente daqui a pouco.",
              );
              router.refresh();
            })
          }
          disabled={isPending}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm font-medium text-gray-700 px-4 py-2 rounded-md hover:border-[#07366A] transition-all disabled:opacity-60"
        >
          <RefreshCw className="w-4 h-4" aria-hidden="true" />
          Atualizar rastreio
        </button>
      </div>
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
      setPacote(r.pacote);
      if (r.pacote) {
        setCaixa({
          comprimento: String(r.pacote.comprimento),
          largura: String(r.pacote.largura),
          altura: String(r.pacote.altura),
          pesoGramas: String(r.pacote.pesoGramas),
        });
      }
    });
  }

  function comprar() {
    if (escolhido == null) return;
    setComprando(true);
    // Vai junto a opção escolhida: é o que grava a transportadora e o nome do
    // serviço no pedido, para a lista não mostrar "a definir" depois.
    startTransition(async () => {
      const r = await comprarEtiquetaDoPedido(orderId, escolhido, {
        empresa: opcao?.empresa,
        label: opcao?.label,
      });
      setComprando(false);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success("Etiqueta comprada.");
      router.refresh();
    });
  }

  /** Salva a embalagem informada e cota de novo com ela. */
  function aplicarCaixa(limpar = false) {
    startTransition(async () => {
      const dados = limpar
        ? null
        : {
            comprimento: Number(caixa.comprimento.replace(",", ".")),
            largura: Number(caixa.largura.replace(",", ".")),
            altura: Number(caixa.altura.replace(",", ".")),
            pesoGramas: Math.round(Number(caixa.pesoGramas.replace(",", "."))),
          };
      const r = await salvarPacoteDoPedido(orderId, dados);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      setEditandoCaixa(false);
      const nova = await cotarEtiquetaDoPedido(orderId);
      if (!nova.success) {
        toast.error(nova.error);
        return;
      }
      setOpcoes(nova.opcoes);
      setPacote(nova.pacote);
      setEscolhido(nova.opcoes[0]?.servicoId ?? null);
      toast.success(limpar ? "Voltou ao cálculo automático." : "Cotado com a sua embalagem.");
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

          {/* A caixa que foi cotada. O cálculo empilha as medidas dos produtos,
              o que não sabe que a criadeira desmonta e cabe num envelope. */}
          {pacote && !editandoCaixa && (
            <div className="rounded bg-gray-50 border border-gray-200 px-2.5 py-2">
              <p className="text-xs text-gray-600">
                Cotado numa caixa de{" "}
                <strong className="text-[#07366A]">
                  {pacote.comprimento}×{pacote.largura}×{pacote.altura} cm,{" "}
                  {pacote.pesoGramas} g
                </strong>{" "}
                {pacote.manual ? "(medidas suas)" : "(calculado pelos produtos)"}
              </p>
              <button
                type="button"
                onClick={() => setEditandoCaixa(true)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#07366A] underline hover:text-[#FF035C]"
              >
                <Package size={12} aria-hidden="true" />
                Vou embalar diferente
              </button>
            </div>
          )}

          {editandoCaixa && (
            <div className="rounded border border-gray-200 p-2.5 space-y-2">
              <p className="text-xs text-gray-600">
                Meça a embalagem pronta, com o produto dentro.
              </p>
              <div className="flex flex-wrap gap-1">
                {PRESETS.map((pre) => (
                  <button
                    key={pre.nome}
                    type="button"
                    onClick={() =>
                      setCaixa((c) => ({
                        ...c,
                        comprimento: String(pre.comprimento),
                        largura: String(pre.largura),
                        altura: String(pre.altura),
                      }))
                    }
                    className="text-[11px] border border-gray-300 rounded-full px-2 py-0.5 text-gray-600 hover:border-[#07366A]"
                  >
                    {pre.nome} {pre.comprimento}×{pre.largura}×{pre.altura}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    ["comprimento", "Compr."],
                    ["largura", "Larg."],
                    ["altura", "Alt."],
                    ["pesoGramas", "Peso (g)"],
                  ] as const
                ).map(([campo, rotulo]) => (
                  <label key={campo} className="block">
                    <span className="block text-[10px] text-gray-500 mb-0.5">
                      {rotulo}
                    </span>
                    <input
                      value={caixa[campo]}
                      onChange={(e) =>
                        setCaixa((c) => ({ ...c, [campo]: e.target.value }))
                      }
                      inputMode="decimal"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => aplicarCaixa(false)}
                  disabled={isPending}
                  className="text-xs font-medium bg-[#07366A] text-white px-3 py-1.5 rounded-md hover:brightness-125 disabled:opacity-60"
                >
                  Cotar com estas medidas
                </button>
                {pacote?.manual && (
                  <button
                    type="button"
                    onClick={() => aplicarCaixa(true)}
                    disabled={isPending}
                    className="text-xs font-medium border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:border-gray-400"
                  >
                    Voltar ao automático
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditandoCaixa(false)}
                  className="text-xs font-medium text-gray-500 px-2 py-1.5"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

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
