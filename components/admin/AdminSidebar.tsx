"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Image as ImageIcon,
  ShoppingCart,
  Users,
  Settings,
  Fish,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Principal",
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Catálogo",
    items: [
      { href: "/admin/produtos", label: "Produtos", icon: Package },
      { href: "/admin/categorias", label: "Categorias", icon: FolderTree },
      { href: "/admin/hero-slides", label: "Hero da home", icon: ImageIcon },
    ],
  },
  {
    title: "Vendas",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart },
      { href: "/admin/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex flex-col h-full bg-[#07366A] text-white w-60 shrink-0">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10">
        <div className="w-8 h-8 bg-[#FF035C] rounded-md flex items-center justify-center">
          <Fish className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <div className="text-sm font-medium leading-tight">
            Guppy de Linhagem
          </div>
          <div className="text-[10px] text-white/55">Admin</div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-2">
            <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-white/40 uppercase tracking-wider">
              {section.title}
            </div>
            {section.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors ${
                    active
                      ? "bg-[#FF035C] text-white font-medium"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/10 text-[11px] text-white/55">
        v0.1.0 · Marchezi
      </div>
    </aside>
  );
}
