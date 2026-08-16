import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { TrocarSenhaForm } from "@/components/admin/TrocarSenhaForm";
import { membroAtual } from "@/lib/permissoes-server";
import { SemPermissaoError } from "@/lib/permissoes";

// Fica FORA do grupo (painel) de propósito: é para onde o layout do painel manda
// quem ainda está com a senha temporária, e de dentro dele o redirect seria um laço.
export default async function TrocarSenhaPage() {
  let membro;
  try {
    membro = await membroAtual();
  } catch (e) {
    if (e instanceof SemPermissaoError) redirect("/api/sessao-encerrada");
    throw e;
  }

  const obrigatoria = membro.senhaPrecisaTroca;

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
              {obrigatoria ? "Crie sua senha" : "Trocar senha"}
            </h1>
            <p className="text-sm text-gray-500">
              {obrigatoria
                ? `Olá, ${membro.nome.split(" ")[0]}. A senha que te passaram é temporária — escolha uma sua para continuar.`
                : "Escolha uma nova senha para o seu acesso ao painel."}
            </p>
          </div>

          <TrocarSenhaForm obrigatoria={obrigatoria} />

          {!obrigatoria && (
            <Link
              href="/admin"
              className="block text-center text-sm text-gray-500 hover:text-[#FF035C]"
            >
              Voltar ao painel
            </Link>
          )}
        </div>
      </div>
      <Toaster position="top-right" richColors closeButton />
    </main>
  );
}
