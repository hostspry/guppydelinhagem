"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import {
  cancelarCobrancaLeilao,
  registrarPagamentoForaLeilao,
} from "@/actions/leiloes";
import { BaixaManualForm } from "@/components/admin/leiloes/BaixaManual";
import {
  SITUACAO_ARREMATE,
  arremateAberto,
  type SituacaoArremate,
} from "@/lib/leiloes/situacao";
import { formatTelefone } from "@/lib/utils/format";

export type CobrancaLinha = {
  id: string;
  numero: string;
  situacao: SituacaoArremate;
  subtotal: number;
  frete: number;
  total: number;
  /** O cliente já escolheu entrega/frete no link. */
  entregaEscolhida: boolean;
  link: string | null;
  tipoEntrega: "ENVIO" | "RETIRADA";
  modalidadeFrete: string | null;
  destino: string | null;
  cliente: { id: string; nome: string; telefone: string | null; email: string | null };
  itens: { nome: string; valor: number }[];
  /** Texto de cobrança pronto para copiar (lotes, total, frete e link). */
  texto: string;
  /** Pago direto no Pix/PicPay (registrado no painel). */
  pagoForaCom: string | null;
  ultimoPagamento: {
    metodo: string;
    status: string;
    valor: number;
    parcelas: number | null;
    criadoEm: string;
  } | null;
};

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const METODO: Record<string, string> = { PIX: "Pix", CARTAO: "Cartão" };
const STATUS_PAG: Record<string, string> = {
  PENDENTE: "gerado, não pago",
  PAGO: "aprovado",
  EM_ANALISE: "em análise",
  RECUSADO: "recusado",
  ESTORNADO: "estornado",
  EXPIRADO: "vencido",
};

function entregaTexto(c: CobrancaLinha): string {
  if (!c.entregaEscolhida) {
    if (c.situacao !== "PAGA") return "o cliente confere pelo CEP e escolhe terrestre ou aéreo ao pagar";
    return c.frete > 0 ? `Combinada por fora · ${moeda(c.frete)}` : "Combinada por fora";
  }
  if (c.tipoEntrega === "RETIRADA") return "Retirada em Guarapari";
  const modo = c.modalidadeFrete === "AEREO" ? "Aéreo" : "Terrestre";
  return `${modo}${c.destino ? ` para ${c.destino}` : ""} · ${moeda(c.frete)}`;
}

export function CobrancasLeilao({ cobrancas }: { cobrancas: CobrancaLinha[] }) {
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);
  const visiveis = cobrancas.filter((c) => mostrarCanceladas || c.situacao !== "CANCELADA");
  const canceladas = cobrancas.length - cobrancas.filter((c) => c.situacao !== "CANCELADA").length;

  if (cobrancas.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
        Nenhuma cobrança ainda. Lance os lotes e clique em <strong>Cobrar todos</strong>: sai um
        link por arrematante, com todos os lotes dele.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visiveis.map((c) => (
        <CartaoCobranca key={c.id} c={c} />
      ))}
      {canceladas > 0 && (
        <button
          type="button"
          onClick={() => setMostrarCanceladas((v) => !v)}
          className="text-xs text-gray-500 hover:text-[#07366A] underline"
        >
          {mostrarCanceladas ? "Esconder canceladas" : `Mostrar ${canceladas} cancelada(s)`}
        </button>
      )}
    </div>
  );
}

function CartaoCobranca({ c }: { c: CobrancaLinha }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copiado, setCopiado] = useState<"link" | "msg" | null>(null);
  const [foraAberto, setForaAberto] = useState(false);
  const s = SITUACAO_ARREMATE[c.situacao];
  const aberta = arremateAberto(c.situacao);
  // Texto pronto (montado no servidor): o dono só confere e envia.
  const texto = c.texto;

  const digitos = (c.cliente.telefone ?? "").replace(/\D/g, "");
  const comDdi = digitos ? (digitos.length <= 11 ? `55${digitos}` : digitos) : "";
  const waHref = `https://wa.me/${comDdi}?text=${encodeURIComponent(texto)}`;

  async function copiar(valor: string, qual: "link" | "msg") {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(qual);
      toast.success(qual === "link" ? "Link copiado." : "Mensagem copiada.");
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione e copie na mão.");
    }
  }

  function rodar(fn: () => Promise<{ success: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (r.success) toast.success(r.message ?? "Pronto.");
      else toast.error(r.error ?? "Não deu certo.");
      router.refresh();
    });
  }

  const pag = c.ultimoPagamento;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-800">{c.cliente.nome}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            <Link href={`/admin/pedidos/${c.id}`} className="font-mono hover:text-[#FF035C]">
              {c.numero}
            </Link>
            {c.cliente.telefone && ` · ${formatTelefone(c.cliente.telefone)}`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-[#07366A] leading-tight">{moeda(c.total)}</p>
          {c.frete > 0 && (
            <p className="text-xs text-gray-500">
              {moeda(c.subtotal)} + {moeda(c.frete)} frete
            </p>
          )}
        </div>
      </div>

      <ul className="mt-3 text-sm text-gray-700 space-y-0.5">
        {c.itens.map((i, k) => (
          <li key={k} className="flex justify-between gap-3">
            <span className="truncate">{i.nome}</span>
            <span className="text-gray-500 whitespace-nowrap">{moeda(i.valor)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="text-gray-400">Entrega:</dt>
          <dd className="text-gray-700">{entregaTexto(c)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-gray-400">Pagamento:</dt>
          <dd className="text-gray-700">
            {c.pagoForaCom
              ? `pago por fora (${c.pagoForaCom})`
              : pag
              ? `${METODO[pag.metodo] ?? pag.metodo}${pag.parcelas && pag.parcelas > 1 ? ` ${pag.parcelas}x` : ""} ${STATUS_PAG[pag.status] ?? pag.status} em ${dia(pag.criadoEm)}`
              : "nenhuma tentativa ainda"}
          </dd>
        </div>
      </dl>

      {c.situacao !== "CANCELADA" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {c.link && aberta && (
            <>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-medium px-3 py-1.5 rounded-md hover:brightness-110"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {comDdi ? "Mandar no WhatsApp" : "Abrir WhatsApp"}
              </a>
              <button
                type="button"
                onClick={() => copiar(texto, "msg")}
                className="inline-flex items-center gap-1.5 bg-[#07366A] text-white text-xs font-medium px-3 py-1.5 rounded-md hover:brightness-110"
              >
                {copiado === "msg" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar texto da cobrança
              </button>
              <button
                type="button"
                onClick={() => copiar(c.link!, "link")}
                className="inline-flex items-center gap-1.5 border border-gray-300 text-xs px-3 py-1.5 rounded-md hover:bg-gray-50"
              >
                {copiado === "link" ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar link
              </button>
            </>
          )}
          {c.link && (
            <a
              href={c.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 border border-gray-300 text-xs px-3 py-1.5 rounded-md hover:bg-gray-50"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              Ver como o cliente
            </a>
          )}
          {c.situacao !== "PAGA" && (
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setForaAberto((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs text-green-700 px-2 py-1.5 rounded-md hover:bg-green-50 disabled:opacity-60"
              >
                <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Baixa manual
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!confirm(`Cancelar a cobrança de ${c.cliente.nome}? O link para de funcionar e os lotes voltam para "sem cobrança".`)) return;
                  rodar(() => cancelarCobrancaLeilao(c.id));
                }}
                className="inline-flex items-center gap-1.5 text-xs text-red-600 px-2 py-1.5 rounded-md hover:bg-red-50 disabled:opacity-60"
              >
                <Ban className="w-3.5 h-3.5" aria-hidden="true" />
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {foraAberto && c.situacao !== "PAGA" && c.situacao !== "CANCELADA" && (
        <div className="mt-3">
          <BaixaManualForm
            titulo={c.cliente.nome}
            lotes={c.itens}
            subtotal={c.subtotal}
            freteDoLink={c.entregaEscolhida ? c.frete : null}
            onConfirmar={async (input) => {
              const r = await registrarPagamentoForaLeilao(c.id, input);
              if (r.success) router.refresh();
              return r;
            }}
            onFechar={() => setForaAberto(false)}
          />
        </div>
      )}
    </div>
  );
}
