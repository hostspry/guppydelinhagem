"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Star } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_URL, WHATSAPP_DISPLAY } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#loja", label: "Loja" },
  { href: "/linhagens", label: "Linhagens" },
  { href: "/sobre-nos", label: "Sobre Nós" },
  { href: "/conheca-os-guppy", label: "Conheça o Guppy" },
  { href: "/atacado", label: "Atacado" },
  // /blog removido por ora (rota não existe → 404).
  { href: "/contatos", label: "Contatos" },
];

export default function NavBar3() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {/* Barra 3 — nav links (sticky) */}
      <nav className="bg-white border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container-site h-12 flex items-center justify-between">
          {/* Links desktop */}
          <ul className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "text-secondary hover:text-accent font-medium text-sm transition-colors",
                    pathname.startsWith(link.href) &&
                      "font-semibold underline underline-offset-4"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile: hamburger */}
          <button
            className="md:hidden text-primary p-1"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={24} />
          </button>

          {/* Desktop: destaques direita */}
          <div className="hidden md:flex items-center gap-5 text-sm">
            <Link
              href="/linhagens"
              className="flex items-center gap-1.5 text-accent font-semibold hover:text-secondary transition-colors"
            >
              <Star size={14} fill="currentColor" />
              Peixes de Linhagem
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-primary font-medium hover:text-accent transition-colors"
            >
              <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
              {WHATSAPP_DISPLAY}
            </a>
          </div>
        </div>
      </nav>

      {/* Overlay do drawer mobile */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer mobile */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-72 bg-white z-[70] shadow-xl",
          "flex flex-col transition-transform duration-300 ease-in-out md:hidden",
          menuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 bg-primary text-white">
          <span className="font-semibold">Menu</span>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
            className="hover:text-accent transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          <ul>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center py-3 px-5 text-secondary hover:bg-muted hover:text-accent font-medium transition-colors border-b border-border/50",
                    pathname.startsWith(link.href) && "bg-muted font-semibold"
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="px-5 pt-5 space-y-3">
            <Link
              href="/linhagens"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 text-accent font-semibold hover:text-secondary transition-colors"
            >
              <Star size={16} fill="currentColor" />
              Peixes de Linhagem
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary font-medium hover:text-accent transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
              {WHATSAPP_DISPLAY}
            </a>
          </div>
        </nav>
      </div>
    </>
  );
}
