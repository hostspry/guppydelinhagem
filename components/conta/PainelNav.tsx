"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  Clock,
  User,
  MapPin,
  LogOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ITENS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/minha-conta", label: "Visão geral", Icon: LayoutDashboard },
  { href: "/minha-conta/pedidos", label: "Pedidos", Icon: Package },
  { href: "/minha-conta/espera", label: "Lista de espera", Icon: Clock },
  { href: "/minha-conta/perfil", label: "Perfil", Icon: User },
  { href: "/minha-conta/enderecos", label: "Endereços", Icon: MapPin },
];

// Ativo: match exato na visão geral; prefixo nas demais (cobre /pedidos/[numero]).
function estaAtivo(pathname: string, href: string): boolean {
  if (href === "/minha-conta") return pathname === "/minha-conta";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PainelNav({
  nome,
  email,
  image,
}: {
  nome: string | null;
  email: string;
  image?: string | null;
}) {
  const pathname = usePathname();
  const inicial = (nome ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <nav aria-label="Painel do cliente" className="lg:sticky lg:top-6 space-y-4">
      {/* Cabeçalho do usuário */}
      <div className="flex items-center gap-3 rounded-2xl bg-white border border-black/5 p-4 shadow-sm">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            referrerPolicy="no-referrer"
            className="w-11 h-11 rounded-full object-cover border border-gray-200 shrink-0"
          />
        ) : (
          <span className="w-11 h-11 rounded-full bg-[#07366A] text-white grid place-items-center font-bold shrink-0">
            {inicial}
          </span>
        )}
        <div className="min-w-0">
          <p className="font-bold text-[#07366A] text-sm truncate">
            {nome ?? "Cliente"}
          </p>
          <p className="text-xs text-gray-500 truncate">{email}</p>
        </div>
      </div>

      {/* Itens (lista vertical no desktop; rolagem horizontal no mobile) */}
      <ul className="flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1">
        {ITENS.map(({ href, label, Icon }) => {
          const ativo = estaAtivo(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={ativo ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium min-h-11 whitespace-nowrap transition-colors ${
                  ativo
                    ? "bg-[#07366A] text-white"
                    : "text-gray-600 hover:bg-white hover:text-[#07366A]"
                }`}
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium min-h-11 whitespace-nowrap text-gray-500 hover:bg-white hover:text-red-600 transition-colors w-full"
          >
            <LogOut size={17} aria-hidden="true" />
            Sair
          </button>
        </li>
      </ul>
    </nav>
  );
}
