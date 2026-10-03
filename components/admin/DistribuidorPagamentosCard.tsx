"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { registrarPagamentoDistribuidor } from "@/actions/distribuidor";
import { formatBRL } from "@/lib/utils/format";

type Props = {
  orderId: string;
  total: number;
  recebido: number;
  falta: number;
  vencimento: string | null; // ISO
  recebimentos: { id: string; valor: number; data: string; descricao: string }[];
  hoje: string;
};

/** Quanto o distribuidor já pagou, quanto falta, e o botão da próxima parte. */
export function DistribuidorPagamentosCard(p: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(p.hoje);
  const [forma, setForma] = useState("PIX");
  const [isPending, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      const r = await registrarPagamentoDistribuidor({
        orderId: p.orderId,
        valor,
        data,
        formaPagamento: forma,
      });
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Pagamento lançado.");
      setAberto(false);
      setValor("");
      router.refresh();
    });
  }

  const input = "px-2 py-1.5 border border-gray-300 rounded text-sm";
  const dia = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm space-y-3">
      <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide">
        Pagamento do distribuidor
      </h2>
      <div className="space-y-1">
        <p className="flex justify-between text-gray-600">
          Total <span className="text-[#07366A] font-medium">{formatBRL(p.total)}</span>
        </p>
        <p className="flex justify-between text-emerald-700">
          Recebido <span>{formatBRL(p.recebido)}</span>
        </p>
        <p
          className={`flex justify-between font-medium ${p.falta > 0 ? "text-amber-700" : "text-emerald-700"}`}
        >
          {p.falta > 0 ? "Falta" : "Quitado"}
          <span>{formatBRL(p.falta)}</span>
        </p>
        {p.falta > 0 && p.vencimento && (
          <p className="text-xs text-gray-500">Combinado para {dia(p.vencimento)}</p>
        )}
      </div>

      {p.recebimentos.length > 0 && (
        <ul className="border-t border-gray-100 pt-2 space-y-1">
          {p.recebimentos.map((r) => (
            <li key={r.id} className="flex justify-between text-xs text-gray-600">
              <span>{dia(r.data)}</span>
              <span>{formatBRL(r.valor)}</span>
            </li>
          ))}
        </ul>
      )}

      {p.falta > 0 &&
        (aberto ? (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <div className="flex gap-2">
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder={p.falta.toFixed(2).replace(".", ",")}
                className={`${input} w-28`}
                aria-label="Valor recebido"
              />
              <select
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                className={input}
                aria-label="Forma"
              >
                <option value="PIX">Pix</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="CARTAO">Cartão</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={`${input} w-full`}
              aria-label="Data do pagamento"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={salvar}
                disabled={isPending || !valor.trim()}
                className="px-3 py-1.5 bg-[#FF035C] text-white text-xs font-medium rounded-md hover:brightness-110 disabled:opacity-50"
              >
                {isPending ? "..." : "Lançar"}
              </button>
              <button
                type="button"
                onClick={() => setValor(p.falta.toFixed(2).replace(".", ","))}
                className="text-xs text-[#07366A] hover:text-[#FF035C]"
              >
                pagou tudo
              </button>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
              >
                cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FF035C] text-white text-xs font-medium rounded-md hover:brightness-110"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Registrar pagamento
          </button>
        ))}
    </div>
  );
}
