"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ehErroDeVersaoVelha, recarregarUmaVez } from "@/lib/erro-recuperavel";

/**
 * Tela de erro do site e do painel.
 *
 * Antes disso, qualquer erro caía na tela padrão do Next — em inglês, com dois
 * botões e nenhuma pista do que fazer. Aqui a página velha se resolve sozinha
 * (recarrega uma vez, o caso do deploy no meio da sessão), a pessoa lê em
 * português o que aconteceu, e o erro é avisado ao servidor: sem esse aviso,
 * erro que acontece só no navegador não aparece em log nenhum.
 */
export default function TelaDeErro({
  error,
  reset,
  raiz = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** true quando é a borda raiz (o layout do site não está em volta). */
  raiz?: boolean;
}) {
  useEffect(() => {
    // Avisa SEMPRE, inclusive quando vai recarregar: é assim que a gente
    // descobre que a causa foi deploy no meio da sessão, e não outra coisa.
    try {
      fetch("/api/erro-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          nome: error.name,
          mensagem: error.message?.slice(0, 300),
          digest: error.digest,
          url: window.location.pathname + window.location.search,
          versaoVelha: ehErroDeVersaoVelha(error),
        }),
      }).catch(() => {});
    } catch {
      // Sem rede não há o que avisar.
    }

    // Página velha conversando com servidor novo: recarregar resolve. Uma vez
    // só — se o erro voltar, a tela abaixo fica e a pessoa decide o que fazer.
    if (ehErroDeVersaoVelha(error)) recarregarUmaVez();
  }, [error]);

  const titulo = "Essa página não carregou";
  const texto =
    "Foi um problema nosso, não seu. Tente de novo: quase sempre funciona na segunda. Se insistir, fale com a gente no WhatsApp que resolvemos.";

  if (!raiz) {
    return (
      <div className="container-site py-16 flex justify-center">
        <div className="w-full max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-primary">{titulo}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {texto}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center bg-secondary text-white text-sm font-semibold px-5 py-2.5 rounded-pill hover:brightness-110 transition-all"
            >
              Tentar de novo
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center border border-border text-primary text-sm font-semibold px-5 py-2.5 rounded-pill hover:bg-primary/5 transition-all"
            >
              Ir para o início
            </Link>
          </div>
          {error.digest && (
            // Código do erro: é por ele que se acha a falha no log do servidor.
            <p className="text-[11px] text-muted-foreground">
              Código do erro: {error.digest}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Borda raiz: o layout (e o CSS dele) pode não ter carregado, então o estilo
  // vai inline, sem depender de classe nenhuma.
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: "#07366A",
        background: "#ffffff",
      }}
    >
      <div style={{ maxWidth: "420px", textAlign: "center" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 12px" }}>
          {titulo}
        </h1>
        <p style={{ fontSize: "14px", color: "#5b6b80", margin: "0 0 20px" }}>
          {texto}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: "#FF035C",
            color: "#fff",
            border: 0,
            borderRadius: "999px",
            padding: "10px 22px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
        {error.digest && (
          <p style={{ fontSize: "11px", color: "#8a97a8", marginTop: "16px" }}>
            Código do erro: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
