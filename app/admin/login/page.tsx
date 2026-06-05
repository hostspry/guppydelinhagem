"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { signIn } from "next-auth/react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        </div>

        <p className="text-center text-xs text-gray-400">
          Sistema admin · Guppy de Linhagem
        </p>
      </div>
    </main>
  );
}
