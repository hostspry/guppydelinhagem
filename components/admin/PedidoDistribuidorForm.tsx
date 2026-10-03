"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Wand2, X } from "lucide-react";
import { BuscaCliente } from "@/components/admin/pedido-novo/BuscaCliente";
import { criarPedidoDistribuidor } from "@/actions/distribuidor";
import { parseValorBR } from "@/lib/validations/financeiro";
import { formatBRL } from "@/lib/utils/format";

type Item = { nome: string; quantidade: string; valor: string };

const FORMAS = [
  { v: "PIX", l: "Pix" },
  { v: "DINHEIRO", l: "Dinheiro" },
  { v: "CARTAO", l: "Cartão" },
  { v: "BOLETO", l: "Boleto" },
  { v: "OUTRO", l: "Outro" },
] as const;

const itemVazio = (): Item => ({ nome: "", quantidade: "1", valor: "" });

/**
 * Lê a lista do jeito que ela chega no WhatsApp:
 *   "[00:37, 02/10/2026] Fulano: Full White 2 - 100,00"
 *   "150 mix - 450,00"
 *   "30 Espada korraco"            (sem valor: fica para preencher)
 * Número no começo é quantidade; o que vem depois do traço é o valor da linha.
 */
function lerLista(texto: string): Item[] {
  const itens: Item[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta
      .replace(/^\[[^\]]*\]\s*[^:]*:\s*/, "") // carimbo e nome do WhatsApp
      .trim();
    if (!linha) continue;
    const m = /^(?:(\d+)\s+)?(.+?)(?:\s*-\s*(?:R\$\s*)?([\d.,]+))?\s*$/i.exec(linha);
    if (!m) continue;
    const [, qtd, nome, valor] = m;
    itens.push({
      nome: nome.trim(),
      quantidade: qtd ?? "1",
      valor: valor ?? "",
    });
  }
  return itens;
}

const hoje = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function PedidoDistribuidorForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [clienteId, setClienteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [data, setData] = useState(hoje());
  const [colado, setColado] = useState("");
  const [itens, setItens] = useState<Item[]>([itemVazio()]);
  const [total, setTotal] = useState("");
  const [valorPago, setValorPago] = useState("");
  const [forma, setForma] = useState<(typeof FORMAS)[number]["v"]>("PIX");
  const [vencimento, setVencimento] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Record<string, string[]>>({});

  const soma = useMemo(
    () => itens.reduce((s, i) => s + (parseValorBR(i.valor) ?? 0), 0),
    [itens],
  );
  const totalNum = total.trim() ? (parseValorBR(total) ?? 0) : soma;
  const pagoNum = valorPago.trim() ? (parseValorBR(valorPago) ?? 0) : 0;
  const falta = Math.max(0, Math.round((totalNum - pagoNum) * 100) / 100);

  function mudarItem(i: number, campo: keyof Item, valor: string) {
    setItens((atual) => atual.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));
  }

  function aplicarLista() {
    const lidos = lerLista(colado);
    if (lidos.length === 0) {
      toast.error("Não achei itens nesse texto.");
      return;
    }
    // Troca a linha vazia inicial; se já tinha itens, soma ao fim.
    setItens((atual) => [...atual.filter((i) => i.nome.trim()), ...lidos]);
    setColado("");
    const semValor = lidos.filter((i) => !i.valor).length;
    toast.success(
      `${lidos.length} itens lidos.${semValor ? ` ${semValor} sem valor: preencha ou use o total combinado.` : ""}`,
    );
  }

  function salvar() {
    setErros({});
    startTransition(async () => {
      const r = await criarPedidoDistribuidor({
        clienteId,
        nome,
        telefone,
        data,
        itens: itens
          .filter((i) => i.nome.trim())
          .map((i) => ({ ...i, valor: i.valor.trim() || "0" })),
        total,
        valorPago,
        formaPagamento: forma,
        vencimentoSaldo: vencimento,
        observacoes,
      });
      if (!r.success) {
        setErros(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(
        r.falta > 0
          ? `Pedido ${r.numero} salvo. Falta receber ${formatBRL(r.falta)}.`
          : `Pedido ${r.numero} salvo e quitado.`,
      );
      router.push(`/admin/pedidos/${r.orderId}`);
    });
  }

  const input =
    "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";
  const rotulo = "block text-xs font-medium text-gray-600 mb-1";
  const erro = (k: string) =>
    erros[k]?.[0] ? <p className="text-xs text-red-600 mt-1">{erros[k][0]}</p> : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
      <div className="space-y-4">
        {/* Distribuidor */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
            Distribuidor
          </h2>
          {clienteId ? (
            <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm">
              <span className="text-[#07366A] font-medium">{nome}</span>
              <button
                type="button"
                onClick={() => setClienteId(null)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Trocar distribuidor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <BuscaCliente
                onEscolher={(c) => {
                  setClienteId(c.id);
                  setNome(c.nome);
                  setTelefone(c.telefone);
                }}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={rotulo} htmlFor="d-nome">
                    Nome (se for novo)
                  </label>
                  <input
                    id="d-nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className={input}
                  />
                  {erro("nome")}
                </div>
                <div>
                  <label className={rotulo} htmlFor="d-tel">
                    WhatsApp (opcional)
                  </label>
                  <input
                    id="d-tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className={input}
                  />
                </div>
              </div>
            </>
          )}
        </section>

        {/* Itens */}
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
            O que levou
          </h2>
          <div className="mb-4">
            <textarea
              value={colado}
              onChange={(e) => setColado(e.target.value)}
              rows={3}
              placeholder={"Cole a lista do WhatsApp, uma linha por item:\nFull White - 100,00\n150 mix - 450,00"}
              className={input}
            />
            <button
              type="button"
              onClick={aplicarLista}
              disabled={!colado.trim()}
              className="mt-2 inline-flex items-center gap-1.5 border border-gray-300 text-xs font-medium text-gray-700 px-3 py-1.5 rounded-md hover:border-[#07366A] disabled:opacity-40"
            >
              <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
              Ler lista
            </button>
          </div>

          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[1fr_80px_120px_32px] gap-2 text-xs text-gray-500">
              <span>Item</span>
              <span>Qtd</span>
              <span>Valor da linha</span>
              <span />
            </div>
            {itens.map((it, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_64px] sm:grid-cols-[1fr_80px_120px_32px] gap-2"
              >
                <input
                  value={it.nome}
                  onChange={(e) => mudarItem(i, "nome", e.target.value)}
                  placeholder="Ex.: Full Gold"
                  className={input}
                  aria-label="Item"
                />
                <input
                  value={it.quantidade}
                  onChange={(e) => mudarItem(i, "quantidade", e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  className={input}
                  aria-label="Quantidade"
                />
                <input
                  value={it.valor}
                  onChange={(e) => mudarItem(i, "valor", e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={input}
                  aria-label="Valor da linha"
                />
                <button
                  type="button"
                  onClick={() =>
                    setItens((atual) =>
                      atual.length === 1 ? [itemVazio()] : atual.filter((_, j) => j !== i),
                    )
                  }
                  className="text-gray-400 hover:text-red-600 justify-self-start sm:justify-self-center"
                  aria-label="Remover item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {erro("itens")}
          <button
            type="button"
            onClick={() => setItens((a) => [...a, itemVazio()])}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#07366A] hover:text-[#FF035C]"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Adicionar item
          </button>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <label className={rotulo} htmlFor="d-obs">
            Observações
          </label>
          <textarea
            id="d-obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className={input}
          />
        </section>
      </div>

      {/* Pagamento */}
      <aside className="bg-white border border-gray-200 rounded-lg p-5 space-y-3 lg:sticky lg:top-4">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
          Pagamento
        </h2>
        <div>
          <label className={rotulo} htmlFor="d-data">
            Data da retirada
          </label>
          <input
            id="d-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className={input}
          />
        </div>
        <p className="text-sm text-gray-600 flex justify-between">
          Soma dos itens <span className="text-[#07366A]">{formatBRL(soma)}</span>
        </p>
        <div>
          <label className={rotulo} htmlFor="d-total">
            Total combinado (vazio = soma)
          </label>
          <input
            id="d-total"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            inputMode="decimal"
            placeholder={soma.toFixed(2).replace(".", ",")}
            className={input}
          />
          {erro("total")}
        </div>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <div>
            <label className={rotulo} htmlFor="d-pago">
              Já pagou
            </label>
            <input
              id="d-pago"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
              className={input}
            />
          </div>
          <div>
            <label className={rotulo} htmlFor="d-forma">
              Como
            </label>
            <select
              id="d-forma"
              value={forma}
              onChange={(e) => setForma(e.target.value as typeof forma)}
              className={input}
            >
              {FORMAS.map((f) => (
                <option key={f.v} value={f.v}>
                  {f.l}
                </option>
              ))}
            </select>
          </div>
        </div>
        {erro("valorPago")}
        <div className="rounded-md bg-gray-50 px-3 py-2 text-sm space-y-1">
          <p className="flex justify-between font-medium text-[#07366A]">
            Total <span>{formatBRL(totalNum)}</span>
          </p>
          <p className="flex justify-between text-emerald-700">
            Pago <span>{formatBRL(pagoNum)}</span>
          </p>
          <p className="flex justify-between text-amber-700">
            Falta <span>{formatBRL(falta)}</span>
          </p>
        </div>
        {falta > 0 && (
          <div>
            <label className={rotulo} htmlFor="d-venc">
              Combinou pagar o resto quando? (opcional)
            </label>
            <input
              id="d-venc"
              type="date"
              value={vencimento}
              onChange={(e) => setVencimento(e.target.value)}
              className={input}
            />
          </div>
        )}
        <p className="text-xs text-gray-500">
          O valor pago entra no caixa da estufa na hora. O que falta fica como
          conta a receber no financeiro.
        </p>
        <button
          type="button"
          onClick={salvar}
          disabled={isPending}
          className="w-full bg-[#FF035C] text-white text-sm font-medium px-4 py-2 rounded-md hover:brightness-110 disabled:opacity-50"
        >
          {isPending ? "Salvando..." : "Salvar pedido"}
        </button>
      </aside>
    </div>
  );
}
