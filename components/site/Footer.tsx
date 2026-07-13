import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_URL, WHATSAPP_DISPLAY } from "@/lib/constants";
import { REDES } from "@/lib/sobre-content";
import WaveDivider from "./WaveDivider";

function IconInstagram({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconYoutube({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none" />
    </svg>
  );
}

const INSTITUCIONAL = [
  { href: "/linhagens", label: "Linhagens" },
  { href: "/sobre-nos", label: "Sobre Nós" },
  { href: "/conheca-os-guppy", label: "Conheça o Guppy" },
  { href: "/atacado", label: "Atacado" },
  { href: "/contatos", label: "Contatos" },
  // /blog e /politica-de-privacidade removidos por ora (rotas não existem → 404).
];

const LINKS_UTEIS = [
  { href: "/loja", label: "Loja" },
  { href: "/envio", label: "Envio de Peixe Vivo" },
  { href: "/frete", label: "Calcular Frete" },
  { href: "/carrinho", label: "Carrinho" },
  { href: WHATSAPP_URL, label: "Rastreamento de Pedido", external: true },
];

// Canais oficiais e ATIVOS (mesma fonte do sameAs do JSON-LD — consistência de
// entidade). Sem Facebook/LinkedIn: não há conta confirmada e link inventado
// além de quebrar (404) contradiz a entidade que declaramos ao Google.
const SOCIAL = [
  { href: REDES.instagram, label: "Instagram", Icon: IconInstagram },
  { href: REDES.youtube, label: "YouTube", Icon: IconYoutube },
];

export default function Footer() {
  return (
    <footer>
      <WaveDivider fill="#07366A" />

      <div className="bg-primary text-white">
        <div className="container-site py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Coluna 1: Logo + descrição + WhatsApp */}
            <div className="space-y-4">
              <Link href="/">
                <Image
                  src="/logo.png"
                  alt="Guppy de Linhagem"
                  width={832}
                  height={428}
                  className="w-40 h-auto brightness-0 invert"
                />
              </Link>
              <p className="text-sm font-light text-white/80 leading-relaxed">
                Peixes saudáveis, com boa genética e bem cuidados. A gente envia com segurança pra todo o Brasil.
              </p>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-accent text-[#302f2f] font-semibold text-sm px-5 py-2.5 rounded-pill hover:brightness-95 transition-all"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                {WHATSAPP_DISPLAY}
              </a>
            </div>

            {/* Coluna 2: Institucional */}
            <div className="space-y-4">
              <h4 className="text-accent font-semibold text-base">Institucional</h4>
              <ul className="space-y-2">
                {INSTITUCIONAL.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-1.5 text-sm font-light text-white/80 hover:text-accent transition-colors"
                    >
                      <ChevronRight size={14} className="text-accent shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Coluna 3: Links Úteis */}
            <div className="space-y-4">
              <h4 className="text-accent font-semibold text-base">Links Úteis</h4>
              <ul className="space-y-2">
                {LINKS_UTEIS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="flex items-center gap-1.5 text-sm font-light text-white/80 hover:text-accent transition-colors"
                    >
                      <ChevronRight size={14} className="text-accent shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Coluna 4: Marchezi + redes sociais */}
            <div className="space-y-5">
              <div>
                <Image
                  src="/logo-marchezi.png"
                  alt="Marchezi Guppy Farm"
                  width={200}
                  height={100}
                  className="w-36 h-auto"
                />
              </div>
              <p className="text-sm font-light text-white/80 leading-relaxed">
                Marchezi Guppy Farm. Criamos guppies de linhagem há mais de 10 anos.
              </p>
              <div className="flex items-center gap-3">
                {SOCIAL.map(({ href, label, Icon }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="text-white/70 hover:text-accent transition-colors"
                  >
                    <Icon size={20} />
                  </a>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Barra de copyright */}
        <div className="border-t border-accent/30">
          <div className="container-site py-4 text-center text-xs font-light text-white/60">
            © {new Date().getFullYear()} Guppy de Linhagem. Todos os direitos
            reservados. Desenvolvido por Manassés Marchezi.
          </div>
        </div>
      </div>
    </footer>
  );
}
