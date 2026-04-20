import Image from "next/image";
import Link from "next/link";
import { Truck, MapPin, User, ShoppingCart } from "lucide-react";
import NavSearchInput from "./NavSearchInput";
import NavBar3 from "./NavBar3";

function IconInstagram({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconFacebook({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

export default function Navbar() {
  return (
    <header>
      {/* ── Barra 1: top bar navy ── */}
      <div className="bg-primary text-white">
        <div className="container-site h-10 flex items-center justify-between gap-4">
          {/* Esquerda: redes sociais */}
          <div className="flex items-center gap-3 text-sm font-light">
            <span className="hidden sm:inline">Siga-nos:</span>
            <a
              href="https://instagram.com/guppydelinhagem"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="hover:text-accent transition-colors"
            >
              <IconInstagram size={16} />
            </a>
            <a
              href="https://facebook.com/guppydelinhagem"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="hover:text-accent transition-colors"
            >
              <IconFacebook size={16} />
            </a>
          </div>

          {/* Centro: frete grátis */}
          <div className="hidden md:flex items-center gap-2 text-sm font-light">
            <Truck size={16} />
            <span>Frete Grátis Para Pedidos Acima de R$&nbsp;500!</span>
          </div>

          {/* Direita: rastreamento */}
          <a
            href="https://wa.me/27997594173"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-2 text-sm font-light text-white hover:text-accent transition-colors"
          >
            <MapPin size={16} />
            <span>Rastreamento de Pedidos</span>
          </a>
        </div>
      </div>

      {/* ── Barra 2: middle bar (logo + busca + conta/carrinho) ── */}
      <div className="bg-bg-alt">
        <div className="container-site h-24 flex items-center gap-4 lg:gap-8">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <Image
              src="/logo.png"
              alt="Guppy de Linhagem"
              width={832}
              height={428}
              priority
              className="w-36 sm:w-44 lg:w-52 h-auto"
            />
          </Link>

          {/* Busca (client) — escondida em mobile */}
          <div className="flex-1 hidden md:block">
            <NavSearchInput />
          </div>

          {/* Conta + Carrinho */}
          <div className="flex items-center gap-3 ml-auto md:ml-0">
            <Link
              href="/minha-conta"
              className="hidden md:flex items-center gap-2 text-primary hover:text-accent transition-colors font-medium text-sm"
            >
              <User size={20} />
              <span>Minha Conta</span>
            </Link>

            <Link
              href="/carrinho"
              className="relative text-primary hover:text-accent transition-colors"
              aria-label="Carrinho de compras"
            >
              <ShoppingCart size={24} />
              <span className="absolute -top-2 -right-2 bg-secondary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                0
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Barra 3: nav links (client — sticky, active state, drawer mobile) ── */}
      <NavBar3 />
    </header>
  );
}
