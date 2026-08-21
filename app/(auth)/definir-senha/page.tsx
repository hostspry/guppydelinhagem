import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { auth } from "@/lib/auth";
import { TrocarSenhaForm } from "@/components/admin/TrocarSenhaForm";

export const metadata: Metadata = {
  title: "Definir senha | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

/**
 * Primeiro login do cliente cujo acesso foi criado pela loja (venda direta).
 *
 * Fica FORA de /minha-conta de propósito: é para cá que o layout do painel manda
 * quem ainda está com a senha temporária, e de dentro dele o redirect viraria um
 * laço. Depois de definir a senha, a temporária que circulou no WhatsApp para de
 * valer.
 */
export default async function DefinirSenhaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/minha-conta");
  // Quem já tem senha própria não tem o que fazer aqui.
  if (!session.user.senhaPrecisaTroca) redirect("/minha-conta");

  const primeiroNome = (session.user.name ?? "").trim().split(/\s+/)[0] ?? "";

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
            <h1 className="text-xl font-bold text-[#07366A]">
              {primeiroNome ? `Bem-vindo, ${primeiroNome}!` : "Bem-vindo!"}
            </h1>
            <p className="text-sm text-gray-600">
              Crie a sua senha para entrar na sua conta. A senha que a gente te
              mandou vale só para esta primeira vez.
            </p>
          </div>

          <TrocarSenhaForm obrigatoria destino="/minha-conta" />
        </div>

        <p className="text-center text-xs text-gray-400">
          Na sua conta você acompanha seus pedidos e o rastreio da entrega.
        </p>
      </div>
      <Toaster richColors position="top-center" />
    </main>
  );
}
