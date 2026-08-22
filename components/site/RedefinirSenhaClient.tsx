"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { redefinirSenha } from "@/actions/recuperar-senha";

const campo =
  "w-full h-11 px-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-[#FF035C] focus:ring-1 focus:ring-[#FF035C]";

/**
 * Cria a nova senha a partir do link do e-mail.
 *
 * O token vem na URL e é conferido no servidor duas vezes: ao abrir a tela (para
 * não pedir senha à toa quando o link já venceu) e de novo no envio — entre uma
 * coisa e outra o link pode ter expirado ou sido usado.
 */
export default function RedefinirSenhaClient({
  token,
  valido,
  nome,
}: {
  token: string;
  valido: boolean;
  nome?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const r = await redefinirSenha(token, senha, confirmacao);
      if (r.ok) setPronto(true);
      else setErro(r.mensagem);
    });
  }

  const primeiroNome = (nome ?? "").trim().split(/\s+/)[0] ?? "";

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
          {!valido ? (
            <div className="space-y-3 text-center">
              <XCircle
                className="w-10 h-10 text-[#FF035C] mx-auto"
                aria-hidden="true"
              />
              <h1 className="text-xl font-bold text-[#07366A]">
                Este link não vale mais
              </h1>
              <p className="text-sm text-gray-600">
                Links de senha valem por 1 hora e servem uma vez só. Peça um novo
                que eu mando na hora.
              </p>
              <Link
                href="/esqueci-senha"
                className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-[#FF035C] text-sm font-semibold text-white hover:brightness-110 transition-all"
              >
                Pedir outro link
              </Link>
            </div>
          ) : pronto ? (
            <div className="space-y-3 text-center">
              <CheckCircle2
                className="w-10 h-10 text-green-600 mx-auto"
                aria-hidden="true"
              />
              <h1 className="text-xl font-bold text-[#07366A]">Senha criada!</h1>
              <p className="text-sm text-gray-600">
                Agora é só entrar com o seu e-mail e a senha nova.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-[#FF035C] text-sm font-semibold text-white hover:brightness-110 transition-all"
              >
                Ir para o login
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-xl font-bold text-[#07366A]">
                  {primeiroNome ? `Oi ${primeiroNome}!` : "Nova senha"}
                </h1>
                <p className="text-sm text-gray-500">
                  Escolha a senha que você vai usar daqui em diante.
                </p>
              </div>

              <form onSubmit={enviar} className="space-y-3">
                <div>
                  <label
                    htmlFor="senha"
                    className="block text-xs font-medium text-[#07366A] mb-1"
                  >
                    Nova senha
                  </label>
                  <input
                    id="senha"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className={campo}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Pelo menos 8 caracteres.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="confirmacao"
                    className="block text-xs font-medium text-[#07366A] mb-1"
                  >
                    Repita a senha
                  </label>
                  <input
                    id="confirmacao"
                    type="password"
                    autoComplete="new-password"
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    className={campo}
                  />
                </div>

                {erro && (
                  <p role="alert" className="text-sm text-red-700">
                    {erro}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isPending || !senha || !confirmacao}
                  className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg bg-[#FF035C] text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60 transition-all"
                >
                  {isPending && (
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  )}
                  Salvar senha
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
