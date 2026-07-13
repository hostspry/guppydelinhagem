"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart, Truck, Tag, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { VideoThumb } from "@/components/admin/VideoThumb";
import { formatBRL } from "@/lib/utils/format";
import { whatsappLink } from "@/lib/constants";
import {
  validarCupom,
  resolverItensCarrinho,
  type CarrinhoResolvido,
} from "@/actions/checkout";
import { useCart, selectTotalPeixes } from "@/lib/stores/cart";

export default function CarrinhoPage() {
  // Store persistido (localStorage) só existe no client — guarda de hidratação.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = useCart((s) => s.items);
  const updateQty = useCart((s) => s.updateQty);
  const removeItem = useCart((s) => s.removeItem);
  const totalPeixes = useCart(selectTotalPeixes);

  // Cupom secreto digitado (só o código persiste; o desconto vem do servidor).
  const cupom = useCart((s) => s.cupom);
  const setCupom = useCart((s) => s.setCupom);
  const clearCupom = useCart((s) => s.clearCupom);
  const [codigoInput, setCodigoInput] = useState("");
  const [cupomErro, setCupomErro] = useState<string | null>(null);
  const [aplicando, startAplicar] = useTransition();

  // Preço efetivo SEMPRE do servidor (campanha automática + código secreto). O
  // store NÃO dita preço. Recalcula quando itens/quantidades/cupom mudam.
  const [resolvido, setResolvido] = useState<CarrinhoResolvido | null>(null);
  const cartKey =
    items.map((i) => `${i.produtoId}:${i.composicao ?? ""}:${i.quantidade}`).join(",") +
    "|" +
    (cupom ?? "");

  useEffect(() => {
    if (!mounted || items.length === 0) {
      setResolvido(null);
      return;
    }
    let cancelado = false;
    const payload = items.map((i) => ({
      produtoId: i.produtoId,
      composicao: i.composicao,
      quantidade: i.quantidade,
    }));
    resolverItensCarrinho(payload, cupom).then((r) => {
      if (!cancelado) setResolvido(r);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, mounted]);

  // Valida o código secreto salvo: se deixou de valer, remove (sem prometer nada).
  useEffect(() => {
    if (!mounted || !cupom || items.length === 0) return;
    let cancelado = false;
    const payload = items.map((i) => ({
      produtoId: i.produtoId,
      composicao: i.composicao,
      quantidade: i.quantidade,
    }));
    validarCupom(cupom, payload).then((r) => {
      if (!cancelado && !r.ok) clearCupom();
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, mounted]);

  function aplicarCupom() {
    const codigo = codigoInput.trim();
    if (!codigo) {
      setCupomErro("Informe um código.");
      return;
    }
    const payload = items.map((i) => ({
      produtoId: i.produtoId,
      composicao: i.composicao,
      quantidade: i.quantidade,
    }));
    startAplicar(async () => {
      const r = await validarCupom(codigo, payload);
      if (r.ok) {
        setCupom(r.codigo);
        setCupomErro(null);
        setCodigoInput("");
      } else {
        setCupomErro(r.motivo);
      }
    });
  }

  function removerCupom() {
    clearCupom();
    setCupomErro(null);
  }

  if (!mounted) {
    return (
      <div className="container-site py-20">
        <p className="text-muted-foreground">Carregando carrinho…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-site py-20 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <ShoppingCart className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-primary text-2xl font-semibold">
            Seu carrinho está vazio
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Dá uma olhada nos nossos guppys e adicione os que você gostar.
          </p>
        </div>
        <Link
          href="/"
          className="bg-secondary text-white text-sm font-semibold px-6 py-2.5 rounded-pill hover:brightness-110 transition-all"
        >
          Ver produtos
        </Link>
      </div>
    );
  }

  // Subtotais: servidor é a fonte da verdade; fallback no store até resolver.
  const subtotalCheioBase =
    resolvido?.subtotalCheioBase ??
    items.reduce((a, i) => a + i.precoCheio * i.quantidade, 0);
  const subtotalPixEfetivo =
    resolvido?.subtotalPixEfetivo ??
    items.reduce((a, i) => a + i.precoPix * i.quantidade, 0);
  const subtotalCheioEfetivo =
    resolvido?.subtotalCheioEfetivo ?? subtotalCheioBase;

  // Limite de peixes (config, desce do servidor via resolverItensCarrinho).
  const maxPeixes = resolvido?.maxPeixesFreteAuto ?? 10;
  const excedeCaixa = totalPeixes > maxPeixes;
  // Economia REAL do Pix = cartão efetivo − Pix efetivo (ambos já com campanha).
  // No preço único (Pix = cartão) isso dá 0 e as linhas de Pix somem.
  const economiaPix = Math.max(0, subtotalCheioEfetivo - subtotalPixEfetivo);

  // Frete grátis: base = subtotal EFETIVO do cartão (com campanha). Não promete
  // quando o pedido excede o limite de peixes (frete será combinado no WhatsApp).
  const fg = resolvido?.freteGratis;
  const freteGratisAtivo = !!fg?.ativo && fg.acimaDe != null && !excedeCaixa;
  const freteGratisAcimaDe = fg?.acimaDe ?? 0;
  const faltaFreteGratis = Math.max(0, freteGratisAcimaDe - subtotalCheioEfetivo);
  const freteGratisAtingido = freteGratisAtivo && faltaFreteGratis <= 0;
  const freteGratisPct =
    freteGratisAtivo && freteGratisAcimaDe > 0
      ? Math.min(100, Math.round((subtotalCheioEfetivo / freteGratisAcimaDe) * 100))
      : 0;
  const pctPix =
    economiaPix > 0 && subtotalCheioEfetivo > 0
      ? Math.round((economiaPix / subtotalCheioEfetivo) * 100)
      : 0;
  // Cartão com desconto (campanha/cupom incide no cartão) — mostra preço no cartão.
  const temDescontoCartao = subtotalCheioEfetivo < subtotalCheioBase;
  const pctCartao =
    temDescontoCartao && subtotalCheioBase > 0
      ? Math.round(((subtotalCheioBase - subtotalCheioEfetivo) / subtotalCheioBase) * 100)
      : 0;

  function finalizarNoWhatsapp() {
    const linhas = items
      .map(
        (i) => `- ${i.nome} (${i.quantidade}x): ${formatBRL(i.precoCheio * i.quantidade)}`,
      )
      .join("\n");
    const msg = `Olá! Quero fechar este pedido:\n${linhas}\nSubtotal: ${formatBRL(
      subtotalPixEfetivo,
    )} no Pix. Pode me ajudar com o frete e pagamento?`;
    window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="container-site py-12">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-primary text-2xl font-semibold">Seu carrinho</h1>
        <Link
          href="/loja"
          className="text-sm font-medium text-secondary hover:underline shrink-0"
        >
          Continuar comprando
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Lista de itens */}
        <div className="lg:col-span-2 bg-white border border-border rounded-xl divide-y divide-border">
          {items.map((item, idx) => {
            // Preço efetivo do servidor (mesma ordem do payload → casa por índice).
            const r = resolvido?.linhas[idx];
            const precoCheioBase = r ? r.precoCheioBase : item.precoCheio;
            const precoPix = r ? r.precoPixEfetivo : item.precoPix;
            const precoCartao = r ? r.precoCheioEfetivo : item.precoCheio;
            const campanha = r?.tipoCupomVencedor === "CAMPANHA";
            const pct = r
              ? r.descontoPercent
              : precoCheioBase > 0
                ? Math.round((1 - precoPix / precoCheioBase) * 100)
                : 0;
            const temDesc = precoPix < precoCheioBase || pct > 0;
            return (
              <div key={item.variantId} className="flex gap-4 p-4">
                <div className="relative w-16 shrink-0 aspect-[9/16] rounded-lg overflow-hidden bg-muted">
                  {item.thumbnail ? (
                    <VideoThumb src={item.thumbnail} alt={item.nome} sizes="64px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
                      sem mídia
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/loja/${item.slug}`}
                    className="text-primary font-semibold text-sm leading-tight line-clamp-2 hover:text-accent transition-colors"
                  >
                    {item.nome}
                  </Link>
                  {item.composicaoLabel && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.composicaoLabel}
                    </p>
                  )}

                  {/* Selo da campanha (igual à vitrine) */}
                  {campanha && r?.cupomCodigo && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#07366A] bg-[#FAB82A] px-2 py-0.5 rounded-full">
                      <Tag size={11} aria-hidden="true" />
                      Cupom {r.cupomCodigo} · {pct}% OFF
                    </span>
                  )}

                  {/* Preço unitário: cheio (de/por) + Pix em destaque */}
                  <p className="mt-1 text-sm leading-snug">
                    {temDesc && (
                      <span className="text-muted-foreground line-through mr-1">
                        {formatBRL(precoCheioBase)}
                      </span>
                    )}
                    <span className="text-green-600 font-semibold">
                      {formatBRL(precoPix)}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      {precoCartao === precoPix ? "no Pix ou cartão" : "no Pix"}
                    </span>
                  </p>

                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center border border-border rounded-lg">
                      <button
                        type="button"
                        onClick={() => updateQty(item.variantId, item.quantidade - 1)}
                        disabled={item.quantidade <= 1}
                        aria-label="Diminuir quantidade"
                        className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors [&>svg]:pointer-events-none"
                      >
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium tabular-nums">
                        {item.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.variantId, item.quantidade + 1)}
                        disabled={item.quantidade >= item.estoque}
                        aria-label="Aumentar quantidade"
                        className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors [&>svg]:pointer-events-none"
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeItem(item.variantId);
                      }}
                      aria-label={`Remover ${item.nome}`}
                      // O toque não chegava aqui no mobile porque a coluna de
                      // "Subtotal" (irmã, à direita) estica por toda a altura da
                      // linha (align-items:stretch) e sua caixa invisível cobria a
                      // lixeira, roubando o toque. relative z-10 força a lixeira a
                      // ficar por cima; o subtotal ganhou self-start (não estica).
                      // [&>svg]:pointer-events-none + touch-manipulation mantidos.
                      className="relative z-10 flex items-center justify-center w-11 h-11 -my-1 shrink-0 touch-manipulation text-muted-foreground hover:text-secondary transition-colors [&>svg]:pointer-events-none"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="text-right shrink-0 self-start">
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="text-green-600 font-bold">
                    {formatBRL(precoPix * item.quantidade)}
                  </p>
                  {temDesc && (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatBRL(precoCheioBase * item.quantidade)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Resumo */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 lg:sticky lg:top-4">
          <h2 className="text-primary font-semibold">Resumo</h2>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Peixes no carrinho</span>
            <span className="tabular-nums">{totalPeixes}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-primary">Subtotal</span>
            <span className="text-primary font-semibold tabular-nums">
              {formatBRL(subtotalCheioBase)}
            </span>
          </div>

          {economiaPix > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-700">Você economiza no Pix</span>
              <span className="text-green-700 font-medium tabular-nums">
                − {formatBRL(economiaPix)}
              </span>
            </div>
          )}

          {/* Cupom secreto (código digitado; não aparece na vitrine) */}
          <div className="border-t border-border pt-3">
            {cupom ? (
              <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-sm text-green-700 font-medium">
                  <Tag size={14} aria-hidden="true" />
                  Cupom {cupom}
                </span>
                <button
                  type="button"
                  onClick={removerCupom}
                  aria-label="Remover cupom"
                  className="text-green-700 hover:text-secondary transition-colors"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div>
                <label htmlFor="cupom" className="block text-sm text-primary mb-1.5">
                  Cupom de desconto
                </label>
                <div className="flex gap-2">
                  <input
                    id="cupom"
                    value={codigoInput}
                    onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        aplicarCupom();
                      }
                    }}
                    placeholder="Digite o código"
                    className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-secondary/40"
                  />
                  <button
                    type="button"
                    onClick={aplicarCupom}
                    disabled={aplicando}
                    className="shrink-0 bg-primary text-white text-sm font-semibold px-4 rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
                  >
                    {aplicando ? "…" : "Aplicar"}
                  </button>
                </div>
                {cupomErro && (
                  <p className="text-xs text-secondary mt-1.5">{cupomErro}</p>
                )}
              </div>
            )}
          </div>

          {/* À vista no Pix — destaque em verde (decisão do dono) */}
          <div className="flex items-end justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-primary">
              À vista no Pix{pctPix > 0 ? ` (${pctPix}% OFF)` : ""}
            </span>
            <span className="text-green-600 text-2xl font-bold tabular-nums">
              {formatBRL(subtotalPixEfetivo)}
            </span>
          </div>
          {temDescontoCartao && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-primary">
                No cartão{pctCartao > 0 ? ` (${pctCartao}% OFF)` : ""}
              </span>
              <span className="text-primary font-semibold tabular-nums">
                {formatBRL(subtotalCheioEfetivo)}
              </span>
            </div>
          )}

          {/* Frete grátis — progresso sobre o valor efetivo (cartão com campanha) */}
          {freteGratisAtivo && (
            <div className="rounded-lg bg-bg-alt p-2.5 space-y-1.5">
              <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                <Truck size={15} className="shrink-0 text-green-600" aria-hidden="true" />
                {freteGratisAtingido
                  ? "Você ganhou frete grátis!"
                  : `Faltam ${formatBRL(faltaFreteGratis)} para o frete grátis`}
              </p>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-[width] duration-500"
                  style={{ width: `${freteGratisPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Frete — aviso VISÍVEL (calculado no checkout, não incluso ainda) */}
          <div className="flex items-start gap-2 text-sm bg-bg-alt rounded-lg p-2.5">
            <Truck size={16} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-primary leading-snug">
              Frete{" "}
              <span className="text-muted-foreground">
                calculado no checkout pelo seu CEP (ainda não incluído no total
                acima).
              </span>
            </span>
          </div>

          {excedeCaixa && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-md p-2 leading-snug">
              Para mais de {maxPeixes} peixes, o frete precisa ser recalculado.
              Fale com o criador no WhatsApp ao finalizar.
            </p>
          )}

          <Link
            href="/checkout"
            className="block w-full text-center bg-secondary text-white text-sm font-semibold py-3 rounded-pill hover:brightness-110 transition-all"
          >
            Finalizar compra
          </Link>

          <p className="text-[11px] text-muted-foreground text-center leading-snug">
            Pague com Pix ou cartão no checkout.
          </p>

          <button
            type="button"
            onClick={finalizarNoWhatsapp}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium text-primary py-2.5 rounded-pill border border-border hover:border-primary transition-all"
          >
            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
            Prefiro fechar no WhatsApp
          </button>

          <Link
            href="/loja"
            className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Continuar comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
