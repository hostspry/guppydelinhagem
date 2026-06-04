import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle, Star, Trophy } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/constants";

const BUBBLES = [
  { top: "12%", left: "18%", size: 8, opacity: 0.4 },
  { top: "24%", left: "72%", size: 12, opacity: 0.3 },
  { top: "48%", left: "10%", size: 6, opacity: 0.5 },
  { top: "62%", left: "78%", size: 10, opacity: 0.25 },
  { top: "78%", left: "32%", size: 7, opacity: 0.35 },
];

export default function HeroHome() {
  return (
    <div className="container-site relative pt-16 pb-12 md:pt-24 md:pb-20">
      {/* Decoração canto superior direito */}
      <svg
        className="absolute top-8 right-8 pointer-events-none opacity-[0.08]"
        width="120"
        height="120"
        viewBox="0 0 120 120"
        aria-hidden="true"
      >
        <circle cx="30" cy="30" r="22" fill="#07366a" />
        <circle cx="80" cy="50" r="16" fill="#ff035c" />
        <circle cx="50" cy="90" r="20" fill="#fab82a" />
      </svg>

      <div className="grid grid-cols-1 md:grid-cols-[55%_45%] gap-10 items-center">
        {/* Coluna texto */}
        <div className="space-y-6 order-2 md:order-1">
          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-accent" aria-hidden="true" />
            <span className="text-xs font-medium text-accent uppercase tracking-[0.2em]">
              Novos guppies disponíveis
            </span>
          </div>

          {/* H1 */}
          <h1 className="leading-[0.95] tracking-tight font-extrabold">
            <span className="block text-5xl md:text-6xl lg:text-[76px] text-primary">
              Guppys de
            </span>
            <span className="block text-5xl md:text-6xl lg:text-[76px] text-secondary">
              Linhagem
            </span>
          </h1>

          {/* Parágrafo */}
          <p className="text-[17px] text-[#555] leading-relaxed max-w-[480px]">
            Peixes selecionados, saudáveis e com genética apurada para
            aquaristas exigentes. Envio seguro para todo o Brasil.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/loja"
              className="inline-flex items-center justify-center gap-2 bg-secondary text-white hover:text-white font-semibold px-7 py-4 rounded-pill shadow-[0_8px_24px_-8px_rgba(255,3,92,0.5)] hover:brightness-110 transition-all"
            >
              Ver catálogo
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-transparent border-2 border-primary text-primary font-semibold px-6 py-[14px] rounded-pill hover:bg-primary hover:text-white transition-all"
            >
              <MessageCircle size={18} aria-hidden="true" />
              Falar no WhatsApp
            </a>
          </div>

          {/* Prova social */}
          <div className="border-t border-black/10 pt-5 mt-2 flex items-center gap-3">
            <div className="flex items-center gap-0.5" aria-label="Avaliação 5 de 5 estrelas">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} size={16} className="fill-accent text-accent" aria-hidden="true" />
              ))}
            </div>
            <span className="text-[13px] text-[#666]">
              Marchezi Guppy Farm · 10 anos de criação
            </span>
          </div>
        </div>

        {/* Coluna imagem */}
        <div className="order-1 md:order-2">
          <div className="relative min-h-[300px] md:min-h-[480px] max-w-[420px] mx-auto flex items-center justify-center">
            {/* Blob aquário */}
            <div
              className="absolute inset-x-4 inset-y-6 md:inset-x-8 md:inset-y-10"
              style={{
                background: "radial-gradient(circle, #07366a 0%, #051f3e 100%)",
                borderRadius: "50% 45% 50% 45%",
                boxShadow: "0 40px 80px -20px rgba(7,54,106,0.4)",
              }}
              aria-hidden="true"
            />

            {/* Bolhinhas */}
            {BUBBLES.map((b, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white pointer-events-none"
                style={{
                  top: b.top,
                  left: b.left,
                  width: b.size,
                  height: b.size,
                  opacity: b.opacity,
                }}
                aria-hidden="true"
              />
            ))}

            {/* Imagem do peixe */}
            <Image
              src="/assets/home/hero-fish.png"
              alt="Guppy de linhagem premium"
              width={380}
              height={280}
              priority
              className="object-contain relative z-[2]"
            />

            {/* Selo flutuante */}
            <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 z-[3] bg-white rounded-xl shadow-lg px-4 py-2.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
                <Trophy size={18} className="text-white" aria-hidden="true" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] uppercase tracking-wider text-[#666]">
                  Linhagem Campeã
                </span>
                <span className="text-sm font-semibold text-primary">
                  Dragon Blue · 2024
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
