import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getDadosPerfil,
  listEsperasDoUsuario,
} from "@/lib/queries/minha-conta";
import { VideoThumb } from "@/components/admin/VideoThumb";
import SairEsperaButton from "@/components/conta/SairEsperaButton";

export const metadata: Metadata = {
  title: "Lista de espera | Guppy de Linhagem",
  robots: { index: false, follow: false },
};

export default async function EsperaPage() {
  const session = await auth();
  const user = session!.user;
  const perfil = await getDadosPerfil(user.id, user.email);
  const esperas = await listEsperasDoUsuario(user.id, perfil.telefone);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-[#07366A]">Lista de espera</h1>

      {esperas.length === 0 ? (
        <div className="rounded-2xl bg-white border border-black/5 p-8 text-center space-y-3 shadow-sm">
          <Clock size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-500">
            Você não está esperando nenhum peixe no momento. Quando um peixe
            esgotar, use o <strong>avise-me</strong> na página dele para entrar na
            lista.
          </p>
          <Link
            href="/"
            className="inline-block text-sm font-semibold text-[#FF035C] hover:underline"
          >
            Ver a loja →
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {esperas.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-4 rounded-xl bg-white border border-black/5 p-3 shadow-sm"
            >
              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                {e.thumb ? (
                  <VideoThumb src={e.thumb} alt={e.produtoNome} sizes="56px" />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/loja/${e.produtoSlug}`}
                  className="text-sm font-semibold text-[#07366A] hover:text-[#FF035C] line-clamp-2"
                >
                  {e.produtoNome}
                </Link>
                <p className="text-xs text-gray-400">
                  Na lista desde{" "}
                  {e.criadoEm.toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </p>
              </div>
              <SairEsperaButton id={e.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
