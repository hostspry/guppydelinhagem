"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

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

function LoginConteudo() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Quem teve o acesso removido chega aqui vindo de /api/sessao-encerrada; sem
  // explicação, a volta ao login pareceria um bug.
  const aviso =
    useSearchParams().get("motivo") === "sem-acesso"
      ? "Seu acesso ao painel foi encerrado. Fale com o dono da loja."
      : null;

  function entrarGoogle() {
    if (loading || googleLoading) return;
    setGoogleLoading(true);
    // Admin via Google: o linking por e-mail verificado conecta à conta existente;
    // o middleware barra quem não for admin. redirect padrão leva ao /admin.
    void signIn("google", { redirectTo: "/admin" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError("E-mail ou senha inválidos.");
        setLoading(false);
        return;
      }
      // Sucesso — força refresh pro middleware reconhecer o cookie
      window.location.href = "/admin";
    } catch {
      setError("Não foi possível entrar agora. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Guppy de Linhagem"
            width={832}
            height={428}
            priority
            className="w-40 h-auto"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-6 md:p-7 space-y-5">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#07366A]">Acesso admin</h1>
            <p className="text-sm text-gray-500">
              Use seu e-mail e senha para entrar.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-[#07366A]"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-[#07366A] placeholder:text-gray-400 focus:outline-none focus:border-[#07366A] focus:ring-2 focus:ring-[#07366A]/15 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#07366A]"
              >
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-gray-200 bg-white text-sm font-medium text-[#07366A] placeholder:text-gray-400 focus:outline-none focus:border-[#07366A] focus:ring-2 focus:ring-[#07366A]/15 transition-all"
              />
            </div>

            {aviso && !error && (
              <div
                role="status"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                {aviso}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-[#FF035C] text-white font-semibold text-sm shadow-[0_8px_24px_-8px_rgba(255,3,92,0.5)] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          {/* Divisor + login com Google (linking por e-mail verificado) */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-gray-400">ou</span>
            </div>
          </div>

          <button
            type="button"
            onClick={entrarGoogle}
            disabled={loading || googleLoading}
            className="inline-flex items-center justify-center gap-3 w-full h-11 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-[#07366A] hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <GoogleLogo />
            )}
            Entrar com Google
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          Sistema admin · Guppy de Linhagem
        </p>
      </div>
    </main>
  );
}

// useSearchParams precisa de um limite de Suspense para a rota não travar o
// prerender do Next.
export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginConteudo />
    </Suspense>
  );
}
