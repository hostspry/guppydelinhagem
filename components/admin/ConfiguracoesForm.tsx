"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { salvarConfiguracaoLoja } from "@/actions/config";
import { RETIRADA_INSTRUCOES_PADRAO } from "@/lib/constants";

const inputClass =
  "w-32 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

export function ConfiguracoesForm({
  inicial,
}: {
  inicial: {
    descontoPixGlobalPercent: number;
    freteGratisAtivo: boolean;
    freteGratisAcimaDe: number | null;
    maxPeixesFreteAuto: number;
    retiradaLocalAtiva: boolean;
    retiradaInstrucoes: string | null;
    tarjaAtiva: boolean;
    tarjaTexto: string | null;
    pagbankAtivo: boolean;
  };
}) {
  const [pct, setPct] = useState(String(inicial.descontoPixGlobalPercent));
  const [freteGratisAtivo, setFreteGratisAtivo] = useState(
    inicial.freteGratisAtivo,
  );
  const [freteGratisAcimaDe, setFreteGratisAcimaDe] = useState(
    inicial.freteGratisAcimaDe == null ? "" : String(inicial.freteGratisAcimaDe),
  );
  const [maxPeixes, setMaxPeixes] = useState(
    String(inicial.maxPeixesFreteAuto),
  );
  const [retiradaAtiva, setRetiradaAtiva] = useState(
    inicial.retiradaLocalAtiva,
  );
  const [retiradaInstrucoes, setRetiradaInstrucoes] = useState(
    inicial.retiradaInstrucoes ?? "",
  );
  const [tarjaAtiva, setTarjaAtiva] = useState(inicial.tarjaAtiva);
  const [tarjaTexto, setTarjaTexto] = useState(inicial.tarjaTexto ?? "");
  const [pagbankAtivo, setPagbankAtivo] = useState(inicial.pagbankAtivo);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("descontoPixGlobalPercent", pct);
    if (freteGratisAtivo) fd.set("freteGratisAtivo", "on");
    fd.set("freteGratisAcimaDe", freteGratisAcimaDe);
    fd.set("maxPeixesFreteAuto", maxPeixes);
    if (retiradaAtiva) fd.set("retiradaLocalAtiva", "on");
    fd.set("retiradaInstrucoes", retiradaInstrucoes);
    if (tarjaAtiva) fd.set("tarjaAtiva", "on");
    fd.set("tarjaTexto", tarjaTexto);
    if (pagbankAtivo) fd.set("pagbankAtivo", "on");
    startTransition(async () => {
      const r = await salvarConfiguracaoLoja(fd);
      if (r.success) toast.success(r.message ?? "Salvo.");
      else toast.error(r.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white border border-gray-200 rounded-lg p-5 max-w-2xl space-y-8"
    >
      <div>
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Desconto Pix global
        </h2>
        <label
          htmlFor="descontoPixGlobalPercent"
          className="block text-sm text-gray-700 mb-1"
        >
          Desconto Pix global (%)
        </label>
        <div className="flex items-center gap-2">
          <input
            id="descontoPixGlobalPercent"
            name="descontoPixGlobalPercent"
            type="number"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className={inputClass}
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
        <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
          Aplicado no Pix aos produtos marcados com{" "}
          <strong>&ldquo;usar desconto Pix global&rdquo;</strong> que não têm
          desconto próprio. Produtos com desconto próprio usam o deles; sem
          nenhum, Pix = preço cheio.
        </p>
      </div>

      {/* ── Frete grátis ── */}
      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Frete grátis
        </h2>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={freteGratisAtivo}
            onChange={(e) => setFreteGratisAtivo(e.target.checked)}
            className="h-4 w-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            Oferecer frete grátis acima de um valor
          </span>
        </label>

        <div className="mt-3">
          <label
            htmlFor="freteGratisAcimaDe"
            className={`block text-sm text-gray-700 mb-1 ${
              freteGratisAtivo ? "" : "opacity-40"
            }`}
          >
            Valor mínimo do pedido (R$)
          </label>
          <div className="flex items-center gap-2">
            <span className={`text-sm text-gray-500 ${freteGratisAtivo ? "" : "opacity-40"}`}>
              R$
            </span>
            <input
              id="freteGratisAcimaDe"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              placeholder="500"
              value={freteGratisAcimaDe}
              onChange={(e) => setFreteGratisAcimaDe(e.target.value)}
              disabled={!freteGratisAtivo}
              className={`${inputClass} disabled:opacity-40 disabled:cursor-not-allowed`}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
            Pedidos com subtotal de produtos (preço cheio) igual ou acima desse
            valor têm o frete zerado no checkout. Desligado, nenhum pedido ganha
            frete grátis e a faixa do topo do site some.
          </p>
        </div>
      </div>

      {/* ── Limite de peixes para frete automático ── */}
      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Frete automático
        </h2>
        <label
          htmlFor="maxPeixesFreteAuto"
          className="block text-sm text-gray-700 mb-1"
        >
          Limite de peixes para frete automático
        </label>
        <input
          id="maxPeixesFreteAuto"
          type="number"
          min={1}
          step={1}
          value={maxPeixes}
          onChange={(e) => setMaxPeixes(e.target.value)}
          className={inputClass}
        />
        <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
          Acima deste número de peixes no pedido, o frete é combinado por WhatsApp
          (a cotação automática só roda até este limite).
        </p>
      </div>

      {/* ── Retirada local ── */}
      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Retirada local
        </h2>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={retiradaAtiva}
            onChange={(e) => setRetiradaAtiva(e.target.checked)}
            className="h-4 w-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            Permitir retirada local (cliente busca em Guarapari/ES)
          </span>
        </label>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="retiradaInstrucoes"
              className={`block text-sm text-gray-700 ${
                retiradaAtiva ? "" : "opacity-40"
              }`}
            >
              Instruções de retirada
            </label>
            <button
              type="button"
              onClick={() => setRetiradaInstrucoes(RETIRADA_INSTRUCOES_PADRAO)}
              disabled={!retiradaAtiva}
              className="text-xs text-[#FF035C] hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
            >
              Usar texto padrão
            </button>
          </div>
          <textarea
            id="retiradaInstrucoes"
            rows={3}
            placeholder={RETIRADA_INSTRUCOES_PADRAO}
            value={retiradaInstrucoes}
            onChange={(e) => setRetiradaInstrucoes(e.target.value)}
            disabled={!retiradaAtiva}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C] disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
            Mostrado ao cliente que escolhe retirar pessoalmente no checkout.
            Vazio usa o texto de exemplo acima. A opção zera o frete e dispensa o
            endereço de entrega.
          </p>
        </div>
      </div>

      {/* ── Tarja promocional do topo ── */}
      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          Tarja promocional (topo do site)
        </h2>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={tarjaAtiva}
            onChange={(e) => setTarjaAtiva(e.target.checked)}
            className="h-4 w-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            Exibir tarja promocional no topo
          </span>
        </label>

        <div className="mt-3">
          <label
            htmlFor="tarjaTexto"
            className={`block text-sm text-gray-700 mb-1 ${
              tarjaAtiva ? "" : "opacity-40"
            }`}
          >
            Texto da tarja
          </label>
          <textarea
            id="tarjaTexto"
            rows={2}
            placeholder="🇧🇷 Brasil em campo! Use o cupom HEXABRASIL e ganhe 50% OFF em todo o plantel."
            value={tarjaTexto}
            onChange={(e) => setTarjaTexto(e.target.value)}
            disabled={!tarjaAtiva}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C] disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
            Faixa fina verde no topo de todas as páginas. Vazio usa o texto de
            exemplo acima. A palavra <strong>HEXABRASIL</strong> aparece destacada
            em amarelo automaticamente.
          </p>
        </div>
      </div>

      {/* ── PagBank (segundo meio de pagamento) ── */}
      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-xs font-semibold text-[#07366A] uppercase tracking-wide mb-3">
          PagBank
        </h2>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={pagbankAtivo}
            onChange={(e) => setPagbankAtivo(e.target.checked)}
            className="h-4 w-4 accent-[#FF035C]"
          />
          <span className="text-sm text-gray-700">
            Oferecer cartão de crédito via PagBank no checkout
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-2 leading-snug max-w-md">
          Liga o cartão de crédito pelo PagBank como 2º adquirente (para
          recuperar cartão recusado pelo Mercado Pago). Desligado, a opção some
          do checkout. Requer a chave pública do PagBank configurada no servidor.
        </p>
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2 bg-[#FF035C] text-white text-sm font-medium rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
