"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";

// Banner de consentimento (LGPD). Decisão persistida em localStorage. Enquanto não
// houver escolha, aparece fixo no rodapé (não-bloqueante). Aceitar → Consent Mode
// `update` granted; Recusar → mantém denied. Lido via useSyncExternalStore para
// não usar setState em efeito (hidratação limpa, sem flash).
const STORAGE_KEY = "consent-lgpd"; // "granted" | "denied" | (ausente = sem escolha)
type Decisao = "granted" | "denied" | null;

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function readDecisao(): Decisao {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}
function setDecisao(v: Exclude<Decisao, null>) {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    // storage indisponível — segue (consent é aplicado abaixo de qualquer forma)
  }
  listeners.forEach((l) => l());
}

function aplicarConsent(v: "granted" | "denied") {
  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  if (typeof w.gtag !== "function") return;
  w.gtag("consent", "update", {
    ad_storage: v,
    analytics_storage: v,
    ad_user_data: v,
    ad_personalization: v,
  });
}

export default function ConsentBanner() {
  const decisao = useSyncExternalStore<Decisao>(
    subscribe,
    readDecisao,
    () => null, // server: sem decisão
  );

  // O consent default volta a denied a cada carga → reaplica "granted" se o
  // usuário já aceitou antes. (Chama gtag, não setState — ok no efeito.)
  useEffect(() => {
    if (decisao === "granted") aplicarConsent("granted");
  }, [decisao]);

  const bannerRef = useRef<HTMLDivElement>(null);
  const visivel = !!process.env.NEXT_PUBLIC_GA_ID && !decisao;

  // Enquanto o banner (fixo no rodapé) está visível, publica a própria altura em
  // --consent-h para o body reservar esse espaço (globals.css). Sem isso, o
  // conteúdo do fim da página fica preso embaixo do banner e o toque nos botões
  // (ex.: remover item no carrinho, no iPhone) bate no banner, não no botão.
  // Re-mede em resize/rotação; zera ao sair (dismiss/unmount).
  useEffect(() => {
    const root = document.documentElement;
    if (!visivel) {
      root.style.setProperty("--consent-h", "0px");
      return;
    }
    const medir = () => {
      const h = bannerRef.current?.offsetHeight ?? 0;
      root.style.setProperty("--consent-h", `${h}px`);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => {
      window.removeEventListener("resize", medir);
      root.style.setProperty("--consent-h", "0px");
    };
  }, [visivel]);

  // Sem GA configurado não há o que consentir; já decidido → não mostra.
  if (!visivel) return null;

  function aceitar() {
    aplicarConsent("granted");
    setDecisao("granted");
  }
  function recusar() {
    aplicarConsent("denied");
    setDecisao("denied");
  }

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-label="Aviso de privacidade"
      className="fixed inset-x-0 bottom-0 z-[200] bg-primary text-white shadow-lg pb-[env(safe-area-inset-bottom)]"
    >
      {/* Compacto no mobile: uma faixa baixa (texto curto + botões na mesma
          linha) para cobrir o mínimo de tela enquanto não é dispensado. */}
      <div className="container-site py-2.5 flex items-center gap-3">
        <p className="text-xs sm:text-sm font-light leading-snug flex-1 line-clamp-2 sm:line-clamp-none">
          Usamos cookies para melhorar o site.{" "}
          {/* TODO: trocar para a página de Política de Privacidade quando existir. */}
          <Link href="/contatos" className="underline hover:text-accent">
            Saiba mais
          </Link>
          .
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={recusar}
            className="min-h-11 px-4 py-1.5 rounded-pill border border-white/40 text-white text-xs sm:text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={aceitar}
            className="min-h-11 px-4 py-1.5 rounded-pill bg-secondary text-white text-xs sm:text-sm font-semibold hover:brightness-110 transition-all"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
