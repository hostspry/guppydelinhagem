import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Package, LogOut, ChevronRight } from "lucide-react";
import { auth, signOut } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Minha conta | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

export default async function MinhaContaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/minha-conta");

  const { name, email, image } = session.user;
  const inicial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="flex justify-center">
          <Image
            src="/logo.png"
            alt="Guppy de Linhagem"
            width={832}
            height={428}
            priority
            className="w-36 h-auto"
          />
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-black/5 p-6 space-y-5">
          <div className="flex items-center gap-4">
            {image ? (
              // Foto vem do CDN do provider (Google/Facebook) — img simples evita
              // config de remotePatterns só para o avatar.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt=""
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <span className="w-14 h-14 rounded-full bg-[#07366A] text-white grid place-items-center text-xl font-bold">
                {inicial}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-bold text-[#07366A] truncate">{name ?? "Cliente"}</p>
              <p className="text-sm text-gray-500 truncate">{email}</p>
            </div>
          </div>

          <Link
            href="/minha-conta/pedidos"
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:border-[#07366A] transition-colors"
          >
            <span className="flex items-center gap-3 text-[#07366A] font-medium">
              <Package size={18} aria-hidden="true" />
              Meus pedidos
            </span>
            <ChevronRight size={18} className="text-gray-400" aria-hidden="true" />
          </Link>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all"
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </form>
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
