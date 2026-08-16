"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { EVENTOS, rastrear } from "@/lib/rastreio/cliente";

/**
 * Marca cada página aberta.
 *
 * O ref evita o disparo dobrado do StrictMode em desenvolvimento e a repetição
 * quando o Next re-renderiza a mesma rota: só uma mudança real de URL conta como
 * página nova.
 */
function RastreadorInterno() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ultima = useRef<string | null>(null);

  useEffect(() => {
    const busca = searchParams.toString();
    const url = busca ? `${pathname}?${busca}` : pathname;
    if (ultima.current === url) return;
    ultima.current = url;

    // O painel não é rastreado como visitante — lá existe a auditoria própria.
    if (pathname.startsWith("/admin")) return;

    rastrear(EVENTOS.PAGINA, { url });

    // Busca do site: guarda o termo como evento próprio, para o dono saber o que
    // as pessoas procuram e não encontram.
    const termo = searchParams.get("q") ?? searchParams.get("busca");
    if (termo && termo.trim().length >= 2) {
      rastrear(EVENTOS.BUSCA, { url, busca: termo.trim() });
    }
  }, [pathname, searchParams]);

  return null;
}

/** useSearchParams precisa de Suspense para não tirar as páginas do prerender. */
export function Rastreador() {
  return (
    <Suspense fallback={null}>
      <RastreadorInterno />
    </Suspense>
  );
}
