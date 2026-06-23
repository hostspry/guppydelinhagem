"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart, Truck, Tag, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { VideoThumb } from "@/components/admin/VideoThumb";
import { formatBRL } from "@/lib/utils/format";
import { whatsappLink, MAX_PEIXES_POR_CAIXA } from "@/lib/constants";
import { validarCupom } from "@/actions/checkout";
import {
  useCart,
  selectTotalPeixes,
  selectSubtotalPix,
  selectSubtotalCheio,
} from "@/lib/stores/cart";

export default function CarrinhoPage() {
  // Store persistido (localStorage) só existe no client — guarda de hidratação.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = useCart((s) => s.items);
  const updateQty = useCart((s) => s.updateQty);
  const removeItem = useCart((s) => s.removeItem);
  const totalPeixes = useCart(selectTotalPeixes);
  const subtotalPix = useCart(selectSubtotalPix);
  const subtotalCheio = useCart(selectSubtotalCheio);

  // ── Cupom ──────────────────────────────────────────────────────────────────
  const cupom = useCart((s) => s.cupom);
  const setCupom = useCart((s) => s.setCupom);
  const clearCupom = useCart((s) => s.clearCupom);
  const [codigoInput, setCodigoInput] = useState("");
  const [cupomDesc, setCupomDesc] = useState<{
    codigo: string;
    modo: "AMBOS_VENCE_MAIOR" | "AMBOS_ACUMULA" | "SO_PIX" | "SO_CARTAO";
    descontoPix: number;
    descontoCartao: number;
  } | null>(null);
  const [cupomErro, setCupomErro] = useState<string | null>(null);
  const [aplicando, startAplicar] = useTransition();

  // Assinatura do carrinho + cupom — revalida o desconto no servidor sempre que
  // itens/quantidades/cupom mudam (o desconto NUNCA vem do client).
  const cartKey =
    items.map((i) => `${i.variantId}:${i.quantidade}`).join(",") +
    "|" +
    (cupom ?? "");

  useEffect(() => {
    if (!mounted) return;
    if (!cupom || items.length === 0) {
      setCupomDesc(null);
      return;
    }
    let cancelado = false;
    const payload = items.map((i) => ({
      produtoId: i.produtoId,
      composicao: i.composicao,
      quantidade: i.quantidade,
    }));
    validarCupom(cupom, payload).then((r) => {
      if (cancelado) return;
      if (r.ok) {
        setCupomDesc({
          codigo: r.codigo,
          modo: r.modo,
          descontoPix: r.descontoPix,
          descontoCartao: r.descontoCartao,
        });
        setCupomErro(null);
      } else {
        // Cupom salvo deixou de valer (expirou/esgotou/carrinho mudou): remove.
        setCupomDesc(null);
        clearCupom();
      }
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
        setCupomDesc({
          codigo: r.codigo,
          modo: r.modo,
          descontoPix: r.descontoPix,
          descontoCartao: r.descontoCartao,
        });
        setCupomErro(null);
        setCodigoInput("");
      } else {
        setCupomErro(r.motivo);
      }
    });
  }

  function removerCupom() {
    clearCupom();
    setCupomDesc(null);
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

  const temDescontoGlobal = subtotalCheio > subtotalPix;
  const economiaPix = subtotalCheio - subtotalPix;
  const pctPix =
    temDescontoGlobal && subtotalCheio > 0
      ? Math.round((economiaPix / subtotalCheio) * 100)
      : 0;
  const excedeCaixa = totalPeixes > MAX_PEIXES_POR_CAIXA;

  // Preview do cupom no melhor preço (Pix). O valor exato por forma de pagamento
  // é recalculado no checkout.
  const descontoCupomPix = cupomDesc?.descontoPix ?? 0;
  const totalPixFinal = Math.max(0, subtotalPix - descontoCupomPix);
  // Cupom "vence o maior": substitui o desconto Pix (não soma). Some a linha
  // "Economia no Pix" e mostra o cupom já com o desconto cheio (cheio → final).
  const cupomAbsorvePix =
    !!cupomDesc && cupomDesc.modo === "AMBOS_VENCE_MAIOR";
  const economiaPixVisivel = temDescontoGlobal && !cupomAbsorvePix;
  const cupomLinhaValorPix = cupomAbsorvePix
    ? economiaPix + descontoCupomPix
    : descontoCupomPix;

  function finalizarNoWhatsapp() {
    const linhas = items
      .map(
        (i) =>
          `- ${i.nome} (${i.quantidade}x): ${formatBRL(i.precoPix * i.quantidade)}`,
      )
      .join("\n");
    const msg = `Olá! Quero fechar este pedido:\n${linhas}\nSubtotal Pix: ${formatBRL(
      subtotalPix,
    )}. Pode me ajudar com o frete e pagamento?`;
    window.open(whatsappLink(msg), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="container-site py-12">
      <h1 className="text-primary text-2xl font-semibold mb-6">
        Seu carrinho
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Lista de itens */}
        <div className="lg:col-span-2 bg-white border border-border rounded-xl divide-y divide-border">
          {items.map((item) => {
            const temDesc = item.precoCheio > item.precoPix;
            const pct =
              temDesc && item.precoCheio > 0
                ? Math.round((1 - item.precoPix / item.precoCheio) * 100)
                : 0;
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
                {/* Preço unit.: cheio (cartão) legível + Pix como desconto */}
                <p className="mt-1 text-sm leading-snug">
                  <span className="text-primary font-semibold">
                    {formatBRL(item.precoCheio)}
                  </span>
                  <span className="text-muted-foreground"> no cartão</span>
                  {temDesc && (
                    <>
                      <span className="text-muted-foreground"> · </span>
                      <span className="text-green-600 font-semibold">
                        {formatBRL(item.precoPix)} no Pix
                      </span>
                      <span className="text-green-700 font-medium"> ({pct}% OFF)</span>
                    </>
                  )}
                </p>

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center border border-border rounded-lg">
                    <button
                      type="button"
                      onClick={() => updateQty(item.variantId, item.quantidade - 1)}
                      disabled={item.quantidade <= 1}
                      aria-label="Diminuir quantidade"
                      className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors"
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
                      className="flex items-center justify-center w-11 h-11 text-primary disabled:opacity-30 hover:text-accent transition-colors"
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
                    // Alvo de toque de 44x44 (mínimo mobile) — o ícone de 16px
                    // sozinho era pequeno demais e os toques erravam no celular.
                    className="flex items-center justify-center w-11 h-11 -my-1 text-muted-foreground hover:text-secondary transition-colors"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Subtotal</p>
                <p className="text-primary font-bold">
                  {formatBRL(item.precoCheio * item.quantidade)}
                </p>
                {temDesc && (
                  <p className="text-xs text-green-600 font-medium">
                    {formatBRL(item.precoPix * item.quantidade)} no Pix
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

          {/* Subtotal no cartão — o preço normal, legível */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-primary">Subtotal no cartão</span>
            <span className="text-primary font-semibold tabular-nums">
              {formatBRL(subtotalCheio)}
            </span>
          </div>

          {economiaPixVisivel && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-700">Economia no Pix</span>
              <span className="text-green-700 font-medium tabular-nums">
                − {formatBRL(economiaPix)}
              </span>
            </div>
          )}

          {/* Cupom de desconto (código digitado; não aparece na vitrine) */}
          <div className="border-t border-border pt-3">
            {cupomDesc ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-sm text-green-700 font-medium">
                    <Tag size={14} aria-hidden="true" />
                    Cupom {cupomDesc.codigo}
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
                {cupomLinhaValorPix > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-green-700">Desconto do cupom (Pix)</span>
                    <span className="text-green-700 font-medium tabular-nums">
                      − {formatBRL(cupomLinhaValorPix)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label
                  htmlFor="cupom"
                  className="block text-sm text-primary mb-1.5"
                >
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
              À vista no Pix{temDescontoGlobal ? ` (${pctPix}% OFF)` : ""}
            </span>
            <span className="text-green-600 text-2xl font-bold tabular-nums">
              {formatBRL(totalPixFinal)}
            </span>
          </div>
          {descontoCupomPix > 0 && (
            <p className="text-[11px] text-muted-foreground -mt-2">
              O desconto exato por forma de pagamento aparece no checkout.
            </p>
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
              Para mais de {MAX_PEIXES_POR_CAIXA} peixes, o frete precisa ser
              recalculado. Fale com o criador no WhatsApp ao finalizar.
            </p>
          )}

          <Link
            href="/checkout"
            className="block w-full text-center bg-secondary text-white text-sm font-semibold py-3 rounded-pill hover:brightness-110 transition-all"
          >
            Finalizar compra
          </Link>

          <p className="text-[11px] text-muted-foreground text-center leading-snug">
            Pague com Pix (com desconto) ou cartão no checkout.
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
            href="/"
            className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Continuar comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
