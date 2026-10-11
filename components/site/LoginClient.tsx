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
  const [carregando, setCarregando] = useState<
    "google" | "facebook" | "senha" | null
  >(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  // Veio pelo link do sorteio: a tela fala do sorteio. O resto é igual.
  const sorteio = callbackUrl.startsWith("/minha-conta/sorteios");
  const criarHref = `/criar-conta?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  const mensagemErro = error
    ? (MENSAGENS_ERRO[error] ?? "Não foi possível entrar. Tente novamente.")
    : null;

  /**
   * Entrada por WhatsApp (ou e-mail) e senha. Serve a quem criou a conta no
   * /criar-conta e ao cliente da venda direta, que recebe uma senha da loja.
   */
  async function entrarComSenha(e: React.FormEvent) {
    e.preventDefault();
    if (carregando) return;
    setErroSenha(null);
    setCarregando("senha");
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password: senha,
        redirect: false,
      });
      if (!res || res.error) {
        setErroSenha(
          "WhatsApp, e-mail ou senha não conferem. Se você já comprou com a gente mas nunca criou uma senha, toque em \"Esqueci a senha\" e use o e-mail do seu cadastro.",
        );
        setCarregando(null);
        return;
      }
      // Recarrega de verdade: o middleware precisa enxergar o cookie novo.
      window.location.href = callbackUrl;
    } catch {
      setErroSenha("Não foi possível entrar agora. Tente de novo.");
      setCarregando(null);
    }
  }

  function entrar(provider: "google" | "facebook") {
    if (carregando) return;
    setCarregando(provider);
    // redirect padrão (true): o provider leva ao OAuth e volta pra callbackUrl.
    void signIn(provider, { redirectTo: callbackUrl });
  }

  const inputCls =
    "w-full h-12 px-3 rounded-lg border border-gray-300 text-base focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

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

        <h1 className="text-center text-2xl font-bold text-[#07366A]">
          {sorteio ? "Veja suas chances no sorteio" : "Entrar ou criar conta"}
        </h1>

        {mensagemErro && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mensagemErro}
          </div>
        )}

        {/* 1. Primeira vez */}
        <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-5 space-y-3">
          <h2 className="text-lg font-bold text-[#07366A]">Primeira vez aqui?</h2>
          <p className="text-sm text-gray-600">
            {sorteio
              ? "Crie sua conta com seus dados. Leva uns 2 minutos, e depois você vê suas chances."
              : "Crie sua conta com seus dados. Leva uns 2 minutos."}
          </p>
          <Link
            href={criarHref}
            className="flex w-full h-12 items-center justify-center rounded-lg bg-[#FF035C] text-base font-semibold text-white hover:brightness-110"
          >
            Criar minha conta
          </Link>
        </section>

        {/* 2. Já tem conta */}
        <section className="bg-white rounded-2xl shadow-sm border border-black/5 p-5 space-y-3">
          <h2 className="text-lg font-bold text-[#07366A]">Já tenho conta</h2>
          <form onSubmit={entrarComSenha} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#07366A] mb-1">
                WhatsApp ou e-mail
              </label>
              <input
                id="email"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="(21) 99999-9999"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-[#07366A] mb-1">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(ev) => setSenha(ev.target.value)}
                className={inputCls}
              />
            </div>

            {erroSenha && (
              <p role="alert" className="text-sm text-red-700">
                {erroSenha}
              </p>
            )}

            <button
              type="submit"
              disabled={carregando !== null || !email || !senha}
              className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-[#07366A] text-base font-semibold text-white hover:bg-[#0E4C8F] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {carregando === "senha" && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              Entrar
            </button>
            <Link href="/esqueci-senha" className="block text-center text-sm text-[#FF035C] hover:underline">
              Esqueci a senha
            </Link>
          </form>
        </section>

        {/* 3. Google */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-500">ou, se preferir</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>
          <button
            type="button"
            onClick={() => entrar("google")}
            disabled={carregando !== null}
            className="inline-flex items-center justify-center gap-3 w-full h-12 rounded-lg border border-gray-300 bg-white text-base font-semibold text-[#07366A] hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {carregando === "google" ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <GoogleLogo />
            )}
            Entrar com a conta Google
          </button>
          <p className="text-center text-xs text-gray-500">
            Para quem já tem Gmail. Não precisa preencher nada.
          </p>

          {facebookEnabled && (
            <button
              type="button"
              onClick={() => entrar("facebook")}
              disabled={carregando !== null}
              className="inline-flex items-center justify-center gap-3 w-full h-12 rounded-lg bg-[#1877F2] text-base font-semibold text-white hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {carregando === "facebook" ? (
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              ) : (
                <FacebookLogo />
              )}
              Entrar com Facebook
            </button>
          )}
        </section>

        <p className="text-center text-xs text-gray-400">
          <Link href="/" className="hover:text-[#FF035C]">
            ← Voltar para a loja
          </Link>
        </p>
      </div>
    </main>
  );
}
