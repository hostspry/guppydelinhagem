"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, MailCheck } from "lucide-react";
import { pedirRecuperacaoSenha } from "@/actions/recuperar-senha";

/**
 * Pedido de nova senha. A tela nunca diz se o e-mail existe — a resposta é a
 * mesma nos dois casos, senão o formulário vira um jeito de descobrir quem é
 * cliente da loja.
 */
export default function EsqueciSenhaClient() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const r = await pedirRecuperacaoSenha(email);
      if (r.ok) setEnviado(r.mensagem);
      else setErro(r.mensagem);
    });
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
          {enviado ? (
            <div className="space-y-3 text-center">
              <MailCheck
                className="w-10 h-10 text-green-600 mx-auto"
                aria-hidden="true"
              />
              <h1 className="text-xl font-bold text-[#07366A]">Confira seu e-mail</h1>
              <p className="text-sm text-gray-600">{enviado}</p>
              <p className="text-xs text-gray-400">
                Não achou? Olhe também no spam. O link vale por 1 hora.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-[#07366A]">
                  Esqueceu a senha?
                </h1>
                <p className="text-sm text-gray-500">
                  Diga o e-mail da sua conta que eu te mando um link para criar
                  uma nova.
                </p>
              </div>

              <form onSubmit={enviar} className="space-y-3">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium text-[#07366A] mb-1"
                  >
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]"
                  />
                </div>

                {erro && (
                  <p role="alert" className="text-sm text-red-700">
                    {erro}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isPending || !email}
                  className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-[#FF035C] text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60 transition-all"
                >
                  {isPending && (
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  )}
                  Enviar link
                </button>
              </form>
            </>
          )}

          <p className="text-center text-xs text-gray-400">
            <Link href="/login" className="hover:underline">
              Voltar para o login
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
