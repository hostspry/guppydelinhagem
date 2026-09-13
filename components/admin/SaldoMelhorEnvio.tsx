"use client";

import { useState, useTransition } from "react";
import {
  Wallet,
  RefreshCw,
  QrCode,
  FileText,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  verSaldoMelhorEnvio,
  gerarRecargaMelhorEnvio,
} from "@/actions/melhorenvio";
import type { MeSaldo, MeRecarga } from "@/lib/melhorenvio";

/**
 * Carteira do Melhor Envio dentro do painel.
 *
 * A etiqueta é paga com o saldo de lá, e a conta só aparecia quando a compra
 * falhava no meio do despacho ("saldo insuficiente"). Aqui o saldo fica à vista
 * e a recarga sai sem abrir o site do Melhor Envio.
 */

const ATALHOS = [20, 50, 100, 200];
/** Abaixo disso, uma etiqueta média já não cabe. Vale avisar antes. */
const SALDO_BAIXO = 30;

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SaldoMelhorEnvio({
  inicial,
  erroInicial,
  podeRecarregar,
}: {
  inicial: MeSaldo | null;
  erroInicial: string | null;
  /** Gerar recarga é dinheiro saindo: só quem tem financeiro.gerenciar. */
  podeRecarregar: boolean;
}) {
  const [saldo, setSaldo] = useState<MeSaldo | null>(inicial);
  const [erro, setErro] = useState<string | null>(erroInicial);
  const [valor, setValor] = useState("50");
  const [metodo, setMetodo] = useState<"pix" | "boleto">("pix");
  const [recarga, setRecarga] = useState<MeRecarga | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [atualizando, iniciarAtualizacao] = useTransition();
  const [gerando, iniciarGeracao] = useTransition();

  function atualizar(silencioso = false) {
    iniciarAtualizacao(async () => {
      const r = await verSaldoMelhorEnvio();
      if (r.ok) {
        setSaldo(r.saldo);
        setErro(null);
        if (!silencioso) toast.success("Saldo atualizado.");
      } else {
        setErro(r.erro);
        if (!silencioso) toast.error(r.erro);
      }
    });
  }

  function gerar() {
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Informe o valor da recarga.");
      return;
    }
    iniciarGeracao(async () => {
      const r = await gerarRecargaMelhorEnvio({ valor: n, metodo });
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      setRecarga(r.recarga);
      toast.success(
        metodo === "pix"
          ? "Pix gerado. Pague e atualize o saldo."
          : "Boleto gerado. O crédito entra depois da compensação.",
      );
    });
  }

  function copiar(texto: string) {
    navigator.clipboard
      .writeText(texto)
      .then(() => {
        setCopiado(true);
        toast.success("Copiado.");
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => toast.error("Não consegui copiar. Selecione e copie na mão."));
  }

  const baixo = saldo != null && saldo.saldo < SALDO_BAIXO;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
          Saldo do Melhor Envio
        </h2>
        <button
          type="button"
          onClick={() => atualizar()}
          disabled={atualizando}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#07366A] hover:text-[#FF035C] disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${atualizando ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Atualizar
        </button>
      </div>

      {erro ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-2.5">
          {erro}
        </p>
      ) : saldo == null ? (
        <p className="text-sm text-gray-500">Sem leitura do saldo.</p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide">
              Disponível
            </p>
            <p
              className={`text-2xl font-bold leading-none ${
                baixo ? "text-amber-600" : "text-[#07366A]"
              }`}
            >
              {moeda(saldo.saldo)}
            </p>
          </div>
          {saldo.reservado > 0 && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                Reservado
              </p>
              <p className="text-sm font-medium text-gray-700">
                {moeda(saldo.reservado)}
              </p>
            </div>
          )}
          {saldo.dividas > 0 && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                Em aberto
              </p>
              <p className="text-sm font-medium text-red-700">
                {moeda(saldo.dividas)}
              </p>
            </div>
          )}
        </div>
      )}

      {baixo && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
          Saldo baixo. Uma etiqueta comum custa mais que isso, e a compra falha
          no meio do despacho quando não cobre.
        </p>
      )}

      {podeRecarregar ? (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <p className="text-xs font-medium text-gray-700">Adicionar crédito</p>

          <div className="flex flex-wrap gap-1.5">
            {ATALHOS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setValor(String(v))}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  valor === String(v)
                    ? "bg-[#07366A] text-white border-[#07366A]"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {moeda(v)}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[140px]">
              <span className="block text-xs text-gray-500 mb-1">Valor (R$)</span>
              <input
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
              />
            </label>

            <label className="min-w-[120px]">
              <span className="block text-xs text-gray-500 mb-1">Forma</span>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as "pix" | "boleto")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:border-[#FF035C]"
              >
                <option value="pix">Pix (cai na hora)</option>
                <option value="boleto">Boleto (1 a 3 dias)</option>
              </select>
            </label>

            <button
              type="button"
              onClick={gerar}
              disabled={gerando}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FF035C] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60"
            >
              {metodo === "pix" ? (
                <QrCode size={15} aria-hidden="true" />
              ) : (
                <FileText size={15} aria-hidden="true" />
              )}
              {gerando ? "Gerando…" : "Gerar"}
            </button>
          </div>

          {recarga && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2">
              <p className="text-xs text-gray-600">
                Cobrança criada
                {recarga.protocolo ? ` (${recarga.protocolo})` : ""}. O saldo sobe
                depois do pagamento confirmado pelo Melhor Envio.
              </p>

              {recarga.link && (
                <a
                  href={recarga.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FF035C] hover:underline"
                >
                  <ExternalLink size={14} aria-hidden="true" />
                  {metodo === "pix" ? "Abrir o QR Code" : "Abrir o boleto"}
                </a>
              )}

              {recarga.copiaECola && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded bg-white border border-gray-200 px-2 py-1 text-[11px]">
                    {recarga.copiaECola}
                  </code>
                  <span className="sr-only">Pix copia e cola</span>
                  <button
                    type="button"
                    onClick={() => copiar(recarga.copiaECola as string)}
                    className="shrink-0 text-[#07366A] hover:text-[#FF035C]"
                  >
                    {copiado ? <Check size={15} /> : <Copy size={15} />}
                    <span className="sr-only">Copiar Pix copia e cola</span>
                  </button>
                </div>
              )}

              {recarga.linhaDigitavel && (
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate rounded bg-white border border-gray-200 px-2 py-1 text-[11px]">
                    {recarga.linhaDigitavel}
                  </code>
                  <button
                    type="button"
                    onClick={() => copiar(recarga.linhaDigitavel as string)}
                    className="shrink-0 text-[#07366A] hover:text-[#FF035C]"
                  >
                    {copiado ? <Check size={15} /> : <Copy size={15} />}
                    <span className="sr-only">Copiar linha digitável</span>
                  </button>
                </div>
              )}

              {!recarga.link &&
                !recarga.copiaECola &&
                !recarga.linhaDigitavel && (
                  <p className="text-xs text-amber-700">
                    A cobrança foi criada, mas o Melhor Envio não devolveu o link
                    de pagamento. Abra a carteira no site deles para pagar.
                  </p>
                )}

              <button
                type="button"
                onClick={() => atualizar()}
                disabled={atualizando}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#07366A] hover:text-[#FF035C] disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${atualizando ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                Já paguei, conferir o saldo
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
          Só quem cuida do financeiro pode adicionar crédito.
        </p>
      )}
    </div>
  );
}
