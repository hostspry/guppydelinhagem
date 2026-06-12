"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { VideoThumb } from "@/components/admin/VideoThumb";
import { formatBRL } from "@/lib/utils/format";
import { whatsappLink, MAX_PEIXES_POR_CAIXA } from "@/lib/constants";
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
            Explore nossos guppys e adicione seus favoritos.
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
  const excedeCaixa = totalPeixes > MAX_PEIXES_POR_CAIXA;

  function finalizarNoWhatsapp() {
    const linhas = items
      .map(
        (i) =>
          `- ${i.nome} (${i.quantidade}x) — ${formatBRL(i.precoPix * i.quantidade)}`,
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
          {items.map((item) => (
            <div key={item.produtoId} className="flex gap-4 p-4">
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
                <p className="text-green-600 font-bold mt-1">
                  {formatBRL(item.precoPix)}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    un. no Pix
                  </span>
                </p>

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center border border-border rounded-lg">
                    <button
                      type="button"
                      onClick={() => updateQty(item.produtoId, item.quantidade - 1)}
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
                      onClick={() => updateQty(item.produtoId, item.quantidade + 1)}
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
                      removeItem(item.produtoId);
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
                  {formatBRL(item.precoPix * item.quantidade)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Resumo */}
        <div className="bg-white border border-border rounded-xl p-5 space-y-4 lg:sticky lg:top-4">
          <h2 className="text-primary font-semibold">Resumo</h2>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Peixes no carrinho</span>
            <span className="tabular-nums">{totalPeixes}</span>
          </div>

          {temDescontoGlobal && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>No cartão</span>
              <span className="line-through tabular-nums">
                {formatBRL(subtotalCheio)}
              </span>
            </div>
          )}

          <div className="flex items-end justify-between border-t border-border pt-3">
            <span className="text-sm font-medium text-primary">
              Subtotal no Pix
            </span>
            <span className="text-green-600 text-2xl font-bold tabular-nums">
              {formatBRL(subtotalPix)}
            </span>
          </div>

          {excedeCaixa && (
            <p className="text-[11px] text-amber-700 bg-amber-50 rounded-md p-2 leading-snug">
              Para mais de {MAX_PEIXES_POR_CAIXA} peixes, o frete precisa ser
              recalculado. Fale com o criador no WhatsApp ao finalizar.
            </p>
          )}

          <button
            type="button"
            onClick={finalizarNoWhatsapp}
            className="w-full bg-green-600 text-white text-sm font-semibold py-3 rounded-pill hover:brightness-110 transition-all"
          >
            Finalizar pedido no WhatsApp
          </button>

          <p className="text-[11px] text-muted-foreground text-center leading-snug">
            O frete e o pagamento são combinados no WhatsApp.
          </p>

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
