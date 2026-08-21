"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Mail, Store, Truck } from "lucide-react";

/**
 * Abas de Configurações. Links de verdade (uma rota por assunto), não estado
 * local: assim cada aba tem endereço próprio, entra no histórico e pode ser
 * mandada para outra pessoa.
 */
const ABAS = [
  { href: "/admin/configuracoes", label: "Loja", icon: Store },
  { href: "/admin/configuracoes/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/admin/configuracoes/entrega", label: "Entrega", icon: Truck },
  { href: "/admin/configuracoes/email", label: "E-mail", icon: Mail },
];

export function ConfigTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções das configurações"
      className="mb-6 border-b border-gray-200"
    >
      <ul className="flex flex-wrap gap-1 -mb-px">
        {ABAS.map((a) => {
          // A raiz só está ativa em correspondência exata: senão "Loja" ficaria
          // acesa junto com todas as filhas.
          const ativa =
            a.href === "/admin/configuracoes"
              ? pathname === a.href
              : pathname.startsWith(a.href);
          const Icone = a.icon;
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={ativa ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  ativa
                    ? "border-[#FF035C] text-[#FF035C]"
                    : "border-transparent text-gray-500 hover:text-[#07366A] hover:border-gray-300"
                }`}
              >
                <Icone className="w-4 h-4" aria-hidden="true" />
                {a.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
