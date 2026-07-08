"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";

// Logo oficial do Google (4 cores).
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function FacebookLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z" />
    </svg>
  );
}

const MENSAGENS_ERRO: Record<string, string> = {
  OAuthAccountNotLinked:
    "Este e-mail já está cadastrado com outra forma de login. Entre pelo método usado da primeira vez.",
  AccessDenied: "Acesso negado. Tente novamente ou use outra conta.",
  Configuration: "Erro de configuração do login. Fale com a gente no WhatsApp.",
};

export default function LoginClient({
  facebookEnabled,
  error,
  callbackUrl,
}: {
  facebookEnabled: boolean;
  error: string | null;
  callbackUrl: string;
}) {
  const [carregando, setCarregando] = useState<"google" | "facebook" | null>(null);
  const mensagemErro = error
    ? (MENSAGENS_ERRO[error] ?? "Não foi possível entrar. Tente novamente.")
    : null;

  function entrar(provider: "google" | "facebook") {
    if (carregando) return;
    setCarregando(provider);
    // redirect padrão (true): o provider leva ao OAuth e volta pra callbackUrl.
    void signIn(provider, { redirectTo: callbackUrl });
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Guppy de Linhagem"
            width={832}
            height={428}
            priority
            className="w-40 h-auto"
          />
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-6 md:p-7 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#07366A]">Entrar</h1>
            <p className="text-sm text-gray-500">
              Acesse sua conta para acompanhar seus pedidos.
            </p>
          </div>

          {mensagemErro && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {mensagemErro}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => entrar("google")}
              disabled={carregando !== null}
              className="inline-flex items-center justify-center gap-3 w-full h-11 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-[#07366A] hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {carregando === "google" ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <GoogleLogo />
              )}
              Continuar com Google
            </button>

            {facebookEnabled && (
              <button
                type="button"
                onClick={() => entrar("facebook")}
                disabled={carregando !== null}
                className="inline-flex items-center justify-center gap-3 w-full h-11 rounded-lg bg-[#1877F2] text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {carregando === "facebook" ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                ) : (
                  <FacebookLogo />
                )}
                Continuar com Facebook
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Ao entrar, você concorda em criar uma conta de cliente para acompanhar
            seus pedidos.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400">
          <Link href="/" className="hover:text-[#FF035C]">
            ← Voltar para a loja
          </Link>
        </p>
      </div>
    </main>
  );
}
