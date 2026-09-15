"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ExternalLink, Sparkles, Wallet } from "lucide-react";
import { salvarSaldoIa } from "@/actions/ia";
import { URL_CREDITOS_GEMINI, URL_USO_GEMINI } from "@/lib/ai/credito";

/**
 * Configurações → IA: gasto do Gemini e saldo de créditos.
 *
 * O saldo EXATO só existe no AI Studio: o Google não deixa ler com a chave da
 * API, e crédito também só se compra lá. O que o site faz é contar o próprio
 * gasto e descontar do saldo que o dono informou.
 */

const URL_COMPRAR = URL_CREDITOS_GEMINI;
const URL_USO = URL_USO_GEMINI;

const usd = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: v > 0 && v < 0.1 ? 4 : 2,
  });
const dataHora = (d: Date) =>
  new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const cartao = "bg-white border border-gray-200 rounded-lg p-5";
const titulo = "text-xs font-semibold text-[#07366A] uppercase tracking-wide";
const input =
  "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function ConfigIa(props: {
  chaveConfigurada: boolean;
  saldoInformado: number | null;
  saldoInformadoEm: Date | null;
  saldoEstimado: number | null;
  alertaUsd: number | null;
  semCreditoEm: Date | null;
  mes: {
    gastoUsd: number;
    chamadas: number;
    porFuncao: { nome: string; chamadas: number; gastoUsd: number }[];
  };
  ultimas: { nome: string; gastoUsd: number; em: Date; tokens: number }[];
}) {
  const router = useRouter();
  const [saldo, setSaldo] = useState(
    props.saldoInformado != null ? props.saldoInformado.toFixed(2).replace(".", ",") : "",
  );
  const [alerta, setAlerta] = useState(
    props.alertaUsd != null ? props.alertaUsd.toFixed(2).replace(".", ",") : "",
  );
  const [pending, start] = useTransition();

  const baixo =
    props.saldoEstimado !== null && props.alertaUsd !== null && props.saldoEstimado <= props.alertaUsd;

  return (
    <div className="max-w-3xl space-y-5">
      {!props.chaveConfigurada && (
        <p className="flex items-start gap-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />A chave do
          Gemini (GEMINI_API_KEY) não está configurada no servidor. Sem ela nenhuma função de IA
          funciona.
        </p>
      )}
      {props.semCreditoEm && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          <p className="flex items-start gap-1.5">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
            Em {dataHora(props.semCreditoEm)} o Google recusou uma chamada por falta de crédito.
            A IA está parada até entrar crédito novo.
          </p>
          <a
            href={URL_COMPRAR}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:brightness-110"
          >
            Adicionar crédito no Google
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      )}

      {/* ── Saldo ── */}
      <section className={`${cartao} space-y-4`}>
        <h2 className={`${titulo} flex items-center gap-1.5`}>
          <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
          Créditos do Gemini
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Numero
            rotulo="Saldo estimado"
            valor={props.saldoEstimado !== null ? usd(props.saldoEstimado) : "não informado"}
            destaque={baixo ? "text-red-700" : undefined}
            nota={
              props.saldoInformadoEm
                ? `informado ${dataHora(props.saldoInformadoEm)}`
                : "informe o saldo abaixo"
            }
          />
          <Numero
            rotulo="Gasto este mês"
            valor={usd(props.mes.gastoUsd)}
            nota={`${props.mes.chamadas} chamada(s)`}
          />
          <Numero
            rotulo="Média por chamada"
            valor={props.mes.chamadas ? usd(props.mes.gastoUsd / props.mes.chamadas) : "—"}
          />
        </div>

        {baixo && (
          <p className="text-xs text-red-700">
            O saldo estimado está abaixo do alerta de {usd(props.alertaUsd ?? 0)}. Hora de comprar
            crédito.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <a
            href={URL_COMPRAR}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#07366A] text-white text-sm font-semibold hover:brightness-110"
          >
            Comprar créditos no AI Studio
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          <a
            href={URL_USO}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:border-[#07366A]"
          >
            Ver saldo exato
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>

        <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 leading-relaxed space-y-1">
          <p>
            <strong>Por que &quot;estimado&quot;:</strong> o Google não deixa o site ler o saldo
            nem comprar crédito pela chave da API. Os dois só existem no AI Studio, com o seu
            login. O site conta o que gasta e desconta do saldo que você informar.
          </p>
          <p>
            <strong>Como comprar:</strong> no AI Studio, Billing → Buy credits (mínimo US$ 5,
            crédito vale 12 meses). Vale ligar o <strong>auto-reload</strong> lá: ele recarrega
            sozinho quando o saldo fica baixo, e a IA do site não para no meio de um cadastro.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">
              Saldo atual no AI Studio (US$)
            </span>
            <input
              inputMode="decimal"
              value={saldo}
              onChange={(e) => setSaldo(e.target.value)}
              placeholder="ex.: 10,00"
              className={input}
            />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Avisar abaixo de (US$)</span>
            <input
              inputMode="decimal"
              value={alerta}
              onChange={(e) => setAlerta(e.target.value)}
              placeholder="ex.: 2,00"
              className={input}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await salvarSaldoIa({ saldoUsd: saldo, alertaUsd: alerta });
              if (!r.ok) {
                toast.error(r.erro);
                return;
              }
              toast.success(r.mensagem);
              router.refresh();
            })
          }
          className="px-4 py-2 rounded-md bg-[#FF035C] text-white text-sm font-semibold hover:brightness-110 disabled:opacity-60"
        >
          Salvar
        </button>
      </section>

      {/* ── Onde gastou ── */}
      <section className={cartao}>
        <h2 className={`${titulo} mb-3 flex items-center gap-1.5`}>
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          Onde a IA gastou este mês
        </h2>
        {props.mes.porFuncao.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma chamada este mês.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-1.5 pr-3 font-medium">Função</th>
                  <th className="py-1.5 pr-3 font-medium text-right">Chamadas</th>
                  <th className="py-1.5 font-medium text-right">Gasto</th>
                </tr>
              </thead>
              <tbody>
                {props.mes.porFuncao.map((f) => (
                  <tr key={f.nome} className="border-b border-gray-50">
                    <td className="py-1.5 pr-3 text-gray-700">{f.nome}</td>
                    <td className="py-1.5 pr-3 text-right text-gray-700">{f.chamadas}</td>
                    <td className="py-1.5 text-right font-medium text-[#07366A]">{usd(f.gastoUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {props.ultimas.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-gray-600">
              Últimas chamadas
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              {props.ultimas.map((u, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {dataHora(u.em)} · {u.nome}
                  </span>
                  <span className="shrink-0">
                    {u.tokens.toLocaleString("pt-BR")} tokens · {usd(u.gastoUsd)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="mt-3 text-[11px] text-gray-500">
          Custo calculado pela tabela do Gemini 2.5 Flash (US$ 0,30 por milhão de tokens de
          entrada e US$ 2,50 por milhão de saída). O valor cobrado de verdade é o do AI Studio.
        </p>
      </section>
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: string;
}) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2.5">
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className={`text-lg font-semibold ${destaque ?? "text-[#07366A]"}`}>{valor}</p>
      {nota && <p className="text-[11px] text-gray-500">{nota}</p>}
    </div>
  );
}
