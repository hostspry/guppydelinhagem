"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, ClipboardPaste, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { FormField } from "@/components/admin/FormField";
import {
  baixaManualArrematante,
  buscarArrematantes,
  cobrarArrematantes,
  excluirLote,
  importarLotes,
  salvarLote,
} from "@/actions/leiloes";
import { SITUACAO_ARREMATE, type SituacaoArremate } from "@/lib/leiloes/situacao";
import { formatTelefone } from "@/lib/utils/format";
import { PEIXES_POR_LOTE } from "@/lib/validations/leilao";
import { BaixaManualForm } from "@/components/admin/leiloes/BaixaManual";

export type LoteLinha = {
  id: string;
  numero: string | null;
  nome: string;
  qtdPeixes: number;
  valor: number;
  cliente: { id: string; nome: string; telefone: string | null };
  cobranca: { numero: string; situacao: SituacaoArremate; freteEscolhido: number | null } | null;
};

const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";
const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const valorCampo = (n: number) => n.toFixed(2).replace(".", ",");

type Cliente = { id: string; nome: string; telefone: string | null };

/**
 * Lotes do leilão: lançar um a um, colar a lista inteira e cobrar todo mundo.
 * Lote em cobrança paga fica travado (o dinheiro já entrou).
 */
export function LotesLeilao({
  leilaoId,
  lotes,
}: {
  leilaoId: string;
  lotes: LoteLinha[];
}) {
  const router = useRouter();
  const [painel, setPainel] = useState<"novo" | "colar" | null>(lotes.length ? null : "colar");
  const [editando, setEditando] = useState<LoteLinha | null>(null);
  const [baixaDe, setBaixaDe] = useState<Cliente | null>(null);
  const [isPending, startTransition] = useTransition();

  // Lotes ainda não pagos do arrematante da baixa manual. O frete do link só
  // vale se tudo dele já estiver na cobrança com entrega escolhida: lote sem
  // cobrança entra nela e zera a escolha (o servidor pede o frete de novo).
  const lotesDaBaixa = baixaDe
    ? lotes.filter((l) => l.cliente.id === baixaDe.id && l.cobranca?.situacao !== "PAGA")
    : [];
  const freteDoLinkDaBaixa =
    lotesDaBaixa.length > 0 && lotesDaBaixa.every((l) => l.cobranca?.freteEscolhido != null)
      ? (lotesDaBaixa[0].cobranca?.freteEscolhido ?? null)
      : null;
  const semCobranca = lotes.filter((l) => !l.cobranca || l.cobranca.situacao === "CANCELADA").length;

  function cobrar() {
    if (!confirm(`Gerar as cobranças dos ${semCobranca} lote(s) sem cobrança? Cada arrematante recebe um link com todos os lotes dele.`)) {
      return;
    }
    startTransition(async () => {
      const r = await cobrarArrematantes(leilaoId);
      if (r.success) toast.success(r.message ?? "Cobranças geradas.");
      else toast.error(r.error);
      router.refresh();
    });
  }

  function excluir(l: LoteLinha) {
    if (!confirm(`Excluir o lote "${l.nome}"?${l.cobranca ? " A cobrança do arrematante é refeita sem ele." : ""}`)) return;
    startTransition(async () => {
      const r = await excluirLote(l.id);
      if (r.success) toast.success(r.message ?? "Excluído.");
      else toast.error(r.error);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-[#07366A] mr-auto">
          Lotes arrematados ({lotes.length})
        </h2>
        <button
          type="button"
          onClick={() => {
            setEditando(null);
            setPainel(painel === "novo" ? null : "novo");
          }}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Lançar lote
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando(null);
            setPainel(painel === "colar" ? null : "colar");
          }}
          className="inline-flex items-center gap-1.5 border border-gray-300 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50"
        >
          <ClipboardPaste className="w-4 h-4" aria-hidden="true" />
          Colar lista
        </button>
        <button
          type="button"
          onClick={cobrar}
          disabled={isPending || semCobranca === 0}
          title={semCobranca === 0 ? "Todos os lotes já estão cobrados." : undefined}
          className="inline-flex items-center gap-1.5 bg-[#FF035C] text-white text-sm font-medium px-4 py-1.5 rounded-md hover:brightness-110 disabled:opacity-50"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          {semCobranca ? `Cobrar todos (${semCobranca})` : "Tudo cobrado"}
        </button>
      </div>

      {(painel === "novo" || editando) && (
        <LoteForm
          key={editando?.id ?? "novo"}
          leilaoId={leilaoId}
          lote={editando}
          onFechar={() => {
            setEditando(null);
            setPainel(null);
          }}
        />
      )}
      {painel === "colar" && !editando && (
        <ColarLista leilaoId={leilaoId} onFechar={() => setPainel(null)} />
      )}
      {baixaDe && lotesDaBaixa.length > 0 && (
        <div className="px-5 py-4 border-b border-gray-100">
          <BaixaManualForm
            key={baixaDe.id}
            titulo={baixaDe.nome}
            lotes={lotesDaBaixa.map((l) => ({
              nome: l.numero ? `Lote ${l.numero} · ${l.nome}` : l.nome,
              valor: l.valor,
            }))}
            subtotal={lotesDaBaixa.reduce((a, l) => a + l.valor, 0)}
            freteDoLink={freteDoLinkDaBaixa}
            onConfirmar={async (input) => {
              const r = await baixaManualArrematante(leilaoId, baixaDe.id, input);
              if (r.success) router.refresh();
              return r;
            }}
            onFechar={() => setBaixaDe(null)}
          />
        </div>
      )}

      {lotes.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-500 text-center">
          Nenhum lote ainda. Cole a lista do leilão ou lance os lotes um a um.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 w-14">Lote</th>
                <th className="px-4 py-2.5">Nome</th>
                <th className="px-4 py-2.5">Arrematante</th>
                <th className="px-4 py-2.5 text-center">Peixes</th>
                <th className="px-4 py-2.5 text-right">Valor</th>
                <th className="px-4 py-2.5">Cobrança</th>
                <th className="px-4 py-2.5 w-36" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lotes.map((l) => {
                const pago = l.cobranca?.situacao === "PAGA";
                const s = l.cobranca ? SITUACAO_ARREMATE[l.cobranca.situacao] : null;
                return (
                  <tr key={l.id} className={editando?.id === l.id ? "bg-amber-50" : "hover:bg-gray-50"}>
                    <td className="px-4 py-2.5 font-mono text-gray-500">{l.numero ?? "·"}</td>
                    <td className="px-4 py-2.5 text-gray-800">{l.nome}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-gray-700">{l.cliente.nome}</span>
                      {l.cliente.telefone && (
                        <span className="block text-xs text-gray-400">{formatTelefone(l.cliente.telefone)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-600">{l.qtdPeixes}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-800">{moeda(l.valor)}</td>
                    <td className="px-4 py-2.5">
                      {s && l.cobranca && l.cobranca.situacao !== "CANCELADA" ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.badge}`} title={l.cobranca.numero}>
                          {s.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">sem cobrança</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {!pago && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setPainel(null);
                              setEditando(null);
                              setBaixaDe(l.cliente);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 mr-1 rounded-md text-xs font-medium text-green-700 hover:bg-green-50"
                            title="Pagou direto no Pix ou PicPay: dá baixa em todos os lotes deste arrematante"
                          >
                            <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            Baixa
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPainel(null);
                              setBaixaDe(null);
                              setEditando(l);
                            }}
                            className="p-1.5 text-gray-400 hover:text-[#07366A]"
                            aria-label={`Editar ${l.nome}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => excluir(l)}
                            disabled={isPending}
                            className="p-1.5 text-gray-400 hover:text-red-600"
                            aria-label={`Excluir ${l.nome}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoteForm({
  leilaoId,
  lote,
  onFechar,
}: {
  leilaoId: string;
  lote: LoteLinha | null;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erros, setErros] = useState<Record<string, string[]>>({});
  const [cliente, setCliente] = useState<Cliente | null>(lote?.cliente ?? null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [achados, setAchados] = useState<{ termo: string; lista: Cliente[] }>({
    termo: "",
    lista: [],
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Busca enquanto digita: nome ou pedaço do número. Resposta de um termo
  // antigo não aparece (só vale a do que está escrito agora).
  const termo = (telefone.replace(/\D/g, "").length >= 4 ? telefone : nome).trim();
  useEffect(() => {
    if (cliente || termo.length < 2) return;
    const t = setTimeout(() => {
      buscarArrematantes(termo)
        .then((lista) => setAchados({ termo, lista }))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [termo, cliente]);
  const sugestoes =
    !cliente && termo.length >= 2 && achados.termo === termo ? achados.lista : [];

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (cliente) fd.set("clienteId", cliente.id);
    startTransition(async () => {
      const r = await salvarLote(leilaoId, lote?.id ?? null, fd);
      if (!r.success) {
        setErros(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Salvo.");
      router.refresh();
      if (lote) {
        onFechar();
        return;
      }
      // Lançamento em sequência: limpa e volta o foco para o próximo lote.
      setErros({});
      setCliente(null);
      setNome("");
      setTelefone("");
      formRef.current?.reset();
      formRef.current?.querySelector<HTMLInputElement>("input[name=numero]")?.focus();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="px-5 py-4 bg-gray-50 border-b border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#07366A]">
          {lote ? `Editar lote${lote.numero ? ` ${lote.numero}` : ""}` : "Lançar lote"}
        </h3>
        <button type="button" onClick={onFechar} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-x-3 grid-cols-2 sm:grid-cols-[5rem_minmax(0,1fr)_5rem_8rem]">
        <FormField label="Lote nº" name="numero" error={erros.numero?.[0]}>
          <input id="numero" name="numero" defaultValue={lote?.numero ?? ""} className={input} placeholder="3" />
        </FormField>
        <div className="col-span-2 sm:col-span-1 order-first sm:order-none">
          <FormField label="Nome do lote" name="nome" required error={erros.nome?.[0]}>
            <input id="nome" name="nome" defaultValue={lote?.nome ?? ""} className={input} placeholder="Trio Red Silverado Albino" />
          </FormField>
        </div>
        <FormField label="Peixes" name="qtdPeixes" error={erros.qtdPeixes?.[0]}>
          <input id="qtdPeixes" name="qtdPeixes" type="number" min={1} max={50} defaultValue={lote?.qtdPeixes ?? PEIXES_POR_LOTE} className={input} />
        </FormField>
        <FormField label="Valor (R$)" name="valor" required error={erros.valor?.[0]}>
          <input
            id="valor"
            name="valor"
            inputMode="decimal"
            defaultValue={lote ? valorCampo(lote.valor) : ""}
            className={input}
            placeholder="150,00"
          />
        </FormField>
      </div>

      {cliente ? (
        <div className="mb-4">
          <span className="block text-xs font-medium text-[#07366A] mb-1">Arrematante</span>
          <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
            <span className="font-medium text-gray-800">{cliente.nome}</span>
            {cliente.telefone && <span className="text-gray-500">{formatTelefone(cliente.telefone)}</span>}
            <button
              type="button"
              onClick={() => setCliente(null)}
              className="ml-auto text-xs text-[#FF035C] hover:underline"
            >
              trocar
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="grid gap-x-3 sm:grid-cols-2">
            <FormField label="Arrematante (nome)" name="clienteNome" required error={erros.clienteNome?.[0]}>
              <input
                id="clienteNome"
                name="clienteNome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={input}
                placeholder="Nome ou como aparece no WhatsApp"
                autoComplete="off"
              />
            </FormField>
            <FormField
              label="WhatsApp"
              name="clienteTelefone"
              error={erros.clienteTelefone?.[0]}
              hint="É por ele que o lote aparece na conta do cliente."
            >
              <input
                id="clienteTelefone"
                name="clienteTelefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className={input}
                placeholder="+55 27 99999-9999"
                autoComplete="off"
              />
            </FormField>
          </div>
          {sugestoes.length > 0 && (
            <ul className="-mt-2 mb-4 rounded-md border border-gray-200 bg-white shadow-sm divide-y divide-gray-100 text-sm">
              <li className="px-3 py-1.5 text-xs text-gray-400">Já cadastrados (clique para usar)</li>
              {sugestoes.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setCliente(s)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="text-gray-800">{s.nome}</span>
                    {s.telefone && <span className="text-xs text-gray-500">{formatTelefone(s.telefone)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#07366A] text-white text-sm font-medium px-5 py-2 rounded-md hover:brightness-110 disabled:opacity-60"
        >
          {isPending ? "Salvando…" : lote ? "Salvar lote" : "Lançar e ir para o próximo"}
        </button>
        {lote?.cobranca && lote.cobranca.situacao !== "CANCELADA" && (
          <p className="text-xs text-gray-500">
            Já está na cobrança {lote.cobranca.numero}: ela é refeita e o cliente confirma o frete de novo.
          </p>
        )}
      </div>
    </form>
  );
}

const EXEMPLO = `Lote;Nome do lote;Arrematante;WhatsApp;Valor;Peixes
01;Red Silverado Albino;João Silva;27 99999-1234;155,00;4
08;Leopardo Red Fire (Mestre Criador: 4 casais + 2 criadeiras MGV16 de brinde);;+55 21 96642-9563;600;8`;

function ColarLista({ leilaoId, onFechar }: { leilaoId: string; onFechar: () => void }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function lancar() {
    startTransition(async () => {
      const r = await importarLotes(leilaoId, texto);
      if (!r.success) {
        setErros(r.erros ?? []);
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Lotes lançados.");
      setTexto("");
      setErros([]);
      router.refresh();
      onFechar();
    });
  }

  return (
    <div className="px-5 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#07366A]">Colar a lista do leilão</h3>
        <button type="button" onClick={onFechar} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">
        Uma linha por lote, nesta ordem: <strong>Lote; Nome do lote; Arrematante; WhatsApp; Valor; Peixes</strong>{" "}
        (peixes é opcional, o padrão é {PEIXES_POR_LOTE}, os 2 casais do vídeo). Dá para colar direto do Google Planilhas ou do Excel. Se
        o arrematante só tem o número, deixe o nome vazio. O mesmo WhatsApp em vários lotes vira um
        cliente só, com uma cobrança só. Xeque-Mate e Mestre Criador do mesmo lote entram como
        linhas separadas, cada uma com o seu valor.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={8}
        className={`${input} font-mono text-xs`}
        placeholder={EXEMPLO}
      />
      {erros.length > 0 && (
        <ul className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-3 space-y-0.5 list-disc pl-5">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={lancar}
        disabled={isPending || !texto.trim()}
        className="bg-[#07366A] text-white text-sm font-medium px-5 py-2 rounded-md hover:brightness-110 disabled:opacity-50"
      >
        {isPending ? "Lançando…" : "Lançar lotes"}
      </button>
    </div>
  );
}
