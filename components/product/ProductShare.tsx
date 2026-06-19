"use client";

import { Share2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

// Compartilhar na PÁGINA do produto. Envia SÓ o link (a prévia rica vem das meta
// tags OG da página). Texto curto = nome do produto, sem preço (preço muda).
//
// Mobile × desktop por CSS (breakpoint lg = 1024px, consistente com o projeto):
//  - Mobile  (< lg) → 1 botão "Compartilhar" = share nativo (navigator.share);
//    fallback copiar link se o aparelho não tiver share.
//  - Desktop (≥ lg) → botões por rede (WhatsApp / Facebook / X) + copiar link.
// A URL é montada no CLIQUE (window.location.origin) — nada de estado/efeito, sem
// mismatch de hidratação e sem precisar de origin no SSR.
export default function ProductShare({
  slug,
  nome,
}: {
  slug: string;
  nome: string;
}) {
  function productUrl() {
    return `${window.location.origin}/loja/${slug}`;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(productUrl());
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  async function compartilharNativo() {
    const url = productUrl();
    // Só o link (sem preço). AbortError = cancelou (silencioso); sem share OU
    // qualquer outra falha → copia o link.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await copiar();
  }

  function abrir(href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
  }

  const botaoBase =
    "inline-flex items-center justify-center gap-1.5 h-11 px-3.5 rounded-lg border border-border text-sm font-medium text-primary hover:border-primary hover:bg-primary/5 transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-primary">Compartilhar:</span>

      {/* Mobile (< lg): share nativo do sistema (fallback copiar). */}
      <button
        type="button"
        onClick={compartilharNativo}
        className={`${botaoBase} bg-primary/5 lg:hidden`}
        aria-label="Compartilhar"
      >
        <Share2 size={16} aria-hidden="true" />
        Compartilhar
      </button>

      {/* Desktop (≥ lg): botões por rede + copiar. */}
      <button
        type="button"
        onClick={() =>
          abrir(
            `https://wa.me/?text=${encodeURIComponent(`${nome} ${productUrl()}`)}`,
          )
        }
        className={`${botaoBase} hidden lg:inline-flex`}
        aria-label="Compartilhar no WhatsApp"
      >
        <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
        WhatsApp
      </button>
      <button
        type="button"
        onClick={() =>
          abrir(
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl())}`,
          )
        }
        className={`${botaoBase} hidden lg:inline-flex`}
        aria-label="Compartilhar no Facebook"
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-[#1877F2]"
          aria-hidden="true"
        >
          <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.25h3.32l-.53 3.49h-2.79v8.44C19.61 23.08 24 18.09 24 12.07Z" />
        </svg>
        Facebook
      </button>
      <button
        type="button"
        onClick={() =>
          abrir(
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(productUrl())}&text=${encodeURIComponent(nome)}`,
          )
        }
        className={`${botaoBase} hidden lg:inline-flex`}
        aria-label="Compartilhar no X"
      >
        <svg
          width={15}
          height={15}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.29L17.61 20.65Z" />
        </svg>
        X
      </button>
      <button
        type="button"
        onClick={copiar}
        className={`${botaoBase} hidden lg:inline-flex`}
        aria-label="Copiar link"
      >
        <Link2 size={16} aria-hidden="true" />
        Copiar link
      </button>
    </div>
  );
}
