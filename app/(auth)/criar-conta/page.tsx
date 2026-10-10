import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CriarContaForm } from "@/components/site/CriarContaForm";

export const metadata: Metadata = {
  title: "Criar conta | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

// Em /criar-conta e não em /cadastro: /cadastro respondia com redirect
// PERMANENTE para o /login, e o navegador guarda isso. Quem já tinha aberto
// cairia no login para sempre.
export default async function CriarContaPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const callbackUrl =
    typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/") && !sp.callbackUrl.startsWith("//")
      ? sp.callbackUrl
      : "/minha-conta";

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  const sorteio = callbackUrl.startsWith("/minha-conta/sorteios");

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Link href="/" className="flex justify-center">
          <Image src="/logo.png" alt="Guppy de Linhagem" width={832} height={428} priority className="h-auto w-36" />
        </Link>
        <header className="text-center">
          <h1 className="text-2xl font-bold text-[#07366A] sm:text-3xl">Criar minha conta</h1>
          <p className="mx-auto mt-2 max-w-md text-base text-gray-600">
            {sorteio
              ? "Preencha uma vez só. Depois é só entrar com seu WhatsApp e a senha para ver suas chances no sorteio e acompanhar seus pedidos."
              : "Preencha uma vez só. Depois é só entrar com seu WhatsApp e a senha para comprar e acompanhar seus pedidos."}
          </p>
        </header>
        <CriarContaForm callbackUrl={callbackUrl} />
      </div>
    </main>
  );
}
