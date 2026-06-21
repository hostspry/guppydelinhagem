import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Trophy,
  Award,
  ArrowRight,
  ExternalLink,
  LayoutGrid,
  Leaf,
  Dna,
  Eye,
  ShieldCheck,
  Package,
  Sparkles,
  HeartPulse,
  Flag,
  Newspaper,
  CalendarDays,
  Bug,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_URL } from "@/lib/constants";
import {
  timeline,
  conquistas,
  estrutura,
  beneficios,
  REDES,
} from "@/lib/sobre-content";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Sobre Nós — Marchezi Guppy Farm | Guppies de linhagem tricampeões mundiais",
  description:
    "Desde 2000, a família Marchezi cria guppies de linhagem no Espírito Santo. Criação familiar pela beleza, com títulos mundiais — incluindo o tricampeonato da linha Full Black.",
  path: "/sobre-nos",
  image: {
    url: "/images/sobrenos/estufa-nova-prateleiras.png",
    width: 895,
    height: 504,
    alt: "Estufa da Marchezi Guppy Farm em Guarapari, ES",
  },
});

const IMG = "/images/sobrenos";

// Ícones de marca (lucide aposentou os brand icons) — SVG próprio (padrão Navbar).
function IconYoutube({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
    </svg>
  );
}
function IconInstagram({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Resolve o nome do ícone (lib/sobre-content) → componente lucide, sem criar
// componente em tempo de render (switch sobre elementos importados).
function Icone({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "LayoutGrid":
      return <LayoutGrid className={className} aria-hidden="true" />;
    case "Leaf":
      return <Leaf className={className} aria-hidden="true" />;
    case "Dna":
      return <Dna className={className} aria-hidden="true" />;
    case "Eye":
      return <Eye className={className} aria-hidden="true" />;
    case "ShieldCheck":
      return <ShieldCheck className={className} aria-hidden="true" />;
    case "Package":
      return <Package className={className} aria-hidden="true" />;
    case "Bug":
      return <Bug className={className} aria-hidden="true" />;
    case "Sparkles":
      return <Sparkles className={className} aria-hidden="true" />;
    case "Trophy":
      return <Trophy className={className} aria-hidden="true" />;
    case "HeartPulse":
      return <HeartPulse className={className} aria-hidden="true" />;
    case "Flag":
      return <Flag className={className} aria-hidden="true" />;
    default:
      return null;
  }
}

// Seção padronizada: largura máx. 1200px, padding 48/80, fundo alternado.
function Secao({
  id,
  bg = "white",
  children,
}: {
  id?: string;
  bg?: "white" | "bege" | "navy";
  children: ReactNode;
}) {
  const bgClass =
    bg === "bege" ? "bg-[#ECE7E8]" : bg === "navy" ? "bg-primary text-white" : "bg-white";
  return (
    <section id={id} className={bgClass}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-12 sm:py-20">{children}</div>
    </section>
  );
}

// Imagem padronizada: proporção controlada + object-cover + radius 22 + sombra.
function Figura({
  src,
  alt,
  ratio = "4 / 3",
  caption,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className = "",
}: {
  src: string;
  alt: string;
  ratio?: string;
  caption?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <figure
      className={`relative w-full overflow-hidden rounded-[22px] shadow-sm bg-bg-alt/60 ${className}`}
      style={{ aspectRatio: ratio }}
    >
      <Image src={src} alt={alt} fill priority={priority} sizes={sizes} className="object-cover" />
      {caption && (
        <figcaption className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-xs sm:text-[13px] px-3 py-2 leading-snug">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

const btnPrimario =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all";
const btnSecundario =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all";

// Seção "Amizades e admiração": todos os retratados autorizaram o uso das imagens.
const MOSTRAR_AMIZADES = true;

export default function SobreNosPage() {
  // Full Black = bloco-herói (não card); demais = cards de apoio.
  const heroi = conquistas.find((c) => c.destaque);
  const apoio = conquistas.filter((c) => !c.destaque);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Sobre a Marchezi Guppy Farm",
    mainEntity: {
      "@type": "Organization",
      name: "Marchezi Guppy Farm",
      description:
        "Criação familiar de guppies de linhagem em Guarapari, Espírito Santo, desde 2000. Criação pela beleza, com linhas premiadas em campeonatos mundiais.",
      founder: { "@type": "Person", name: "Manassés Marchezi" },
      foundingDate: "2000",
      areaServed: "Brasil",
      location: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Guarapari",
          addressRegion: "ES",
          addressCountry: "BR",
        },
      },
      award: conquistas.map((c) => `${c.linha} — ${c.titulo} (${c.anos}), ${c.evento}`),
      sameAs: [REDES.youtube, REDES.instagram],
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ═══ 1. HERO ═══ */}
      <Secao bg="white">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center min-h-[60vh]">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-widest">
              <Trophy size={16} aria-hidden="true" />
              Marchezi Guppy Farm
            </span>
            <h1 className="text-primary text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              Criamos guppies pela beleza.{" "}
              <span className="text-secondary">O mundo reconheceu.</span>
            </h1>
            <p className="text-text font-light text-lg leading-relaxed">
              Desde 2000, a família Marchezi cria guppies de linhagem no Espírito
              Santo. Buscamos a beleza acima de tudo — e, no caminho, vieram os
              títulos mundiais, incluindo o tricampeonato da nossa linha Full
              Black.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/" className={btnPrimario}>
                Ver peixes disponíveis
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a href="#estrutura" className={btnSecundario}>
                Conhecer a estufa
              </a>
            </div>
          </div>
          <Figura
            src={`${IMG}/tres-geracoes.jpg`}
            alt="Três gerações da família Marchezi — avô Vanderli, Manassés e a neta Sarah — na criação de guppies em Guarapari"
            ratio="4 / 5"
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="max-w-md mx-auto lg:max-w-none"
          />
        </div>
      </Secao>

      {/* ═══ 2. QUEM SOMOS ═══ */}
      <Secao bg="bege">
        <div className="max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-bold">
            Uma criação familiar que virou <span className="text-secondary">referência</span>
          </h2>
          <p className="text-text font-light text-lg leading-relaxed">
            A Marchezi Guppy Farm nasceu da paixão por guppies de linhagem e
            cresceu com estudo e seleção contínua. Sempre criamos pela beleza —
            pelo prazer de ver um peixe de cor, cauda e padrão excepcionais — e não
            para competir. O reconhecimento veio como consequência desse cuidado:
            nossas linhagens passaram a se destacar no cenário mundial do guppy.
          </p>
        </div>
      </Secao>

      {/* ═══ 3. FAIXA DE CREDIBILIDADE (prova social REAL, sem estrelas) ═══ */}
      <Secao bg="white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <Trophy size={26} aria-hidden="true" />, titulo: "Tricampeão mundial", sub: "Linha Full Black (2023, 2024, 2025)" },
            { icon: <CalendarDays size={26} aria-hidden="true" />, titulo: "+ de 20 anos de criação", sub: "Selecionando linhagens desde 2000" },
            { icon: <Newspaper size={26} aria-hidden="true" />, titulo: "Destaque n'A Tribuna", sub: "Maior jornal do Espírito Santo" },
          ].map((s) => (
            <div
              key={s.titulo}
              className="flex items-center gap-4 rounded-[22px] border border-border bg-white p-5 shadow-sm"
            >
              <span className="shrink-0 grid place-items-center w-12 h-12 rounded-full bg-secondary/10 text-secondary">
                {s.icon}
              </span>
              <div>
                <p className="text-primary font-bold leading-tight">{s.titulo}</p>
                <p className="text-text/70 text-sm font-light leading-snug">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </Secao>

      {/* ═══ 4. NOSSA TRAJETÓRIA (timeline) ═══ */}
      <Secao bg="bege">
        <h2 className="text-primary text-2xl sm:text-3xl font-bold mb-8">
          Nossa <span className="text-secondary">trajetória</span>
        </h2>
        <ol className="relative space-y-5 before:absolute before:left-[15px] before:top-3 before:bottom-3 before:w-0.5 before:bg-secondary/30">
          {timeline.map((t) => (
            <li key={t.ano} className="relative pl-12">
              <span className="absolute left-2 top-4 w-3.5 h-3.5 rounded-full bg-secondary ring-4 ring-[#ECE7E8]" />
              <div className="rounded-[22px] bg-white shadow-sm border border-border/60 p-5">
                <span className="inline-block text-secondary font-bold">{t.ano}</span>
                <h3 className="text-primary font-semibold text-lg mt-0.5">{t.titulo}</h3>
                <p className="text-text/80 font-light mt-1 leading-relaxed">{t.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </Secao>

      {/* ═══ 5. CONQUISTAS ═══ */}
      <Secao bg="white">
        <div className="max-w-3xl space-y-3 mb-8">
          <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-widest">
            <Award size={16} aria-hidden="true" />
            Reconhecimento
          </span>
          <h2 className="text-primary text-2xl sm:text-3xl font-bold">
            Conquistas que confirmam a <span className="text-secondary">qualidade</span>
          </h2>
        </div>
        {/* BLOCO-HERÓI — Full Black, largura total, monumental (navy). */}
        {heroi && (
          <div className="relative overflow-hidden rounded-[24px] bg-primary text-white p-8 sm:p-12 shadow-md mb-6">
            <Trophy
              className="pointer-events-none absolute -right-6 -bottom-6 w-44 h-44 text-white/5"
              aria-hidden="true"
            />
            <div className="relative space-y-4 max-w-3xl">
              <span className="inline-flex items-center gap-2 text-accent font-bold uppercase tracking-widest text-sm">
                <Trophy size={20} aria-hidden="true" />
                {heroi.titulo}
              </span>
              <h3 className="text-4xl sm:text-6xl font-extrabold leading-none tracking-tight">
                {heroi.linha}
              </h3>
              <p className="text-white/90 text-lg font-semibold">
                2023 • 2024 • 2025 — World Guppy Contest
              </p>
              <p className="text-white/80 font-light leading-relaxed">
                Linha desenvolvida na nossa estufa — três títulos mundiais
                consecutivos. Em 2023, além do título, foi vice no Best of Show: o
                segundo melhor peixe de todo o mundial.
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
                <a
                  href={heroi.video}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all"
                >
                  Ver os vídeos dos títulos
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
                {heroi.videoExtra && (
                  <a
                    href={heroi.videoExtra}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-white/90 hover:text-white transition-colors"
                  >
                    Best of Show 2023
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cards de apoio — Glass Tail e Half Moon, parelhos. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {apoio.map((c) => (
            <article
              key={c.linha}
              className="rounded-[22px] border border-border bg-white p-6 flex flex-col gap-3 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Trophy size={20} className="text-accent" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.titulo}
                </span>
              </div>
              <h3 className="font-bold leading-tight text-primary text-xl">{c.linha}</h3>
              <p className="text-sm font-semibold text-secondary">{c.anos}</p>
              <p className="text-sm text-text/80 leading-snug">{c.evento}</p>
              <p className="text-sm text-text font-light leading-relaxed">{c.nota}</p>
              <div className="mt-auto pt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                <a
                  href={c.video}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-primary hover:text-secondary transition-colors"
                >
                  Ver o vídeo
                  <ArrowRight size={15} aria-hidden="true" />
                </a>
                {c.videoExtra && (
                  <a
                    href={c.videoExtra}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 min-h-11 text-xs text-muted-foreground hover:text-secondary transition-colors"
                  >
                    vídeo extra
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </Secao>

      {/* ═══ 6. ESTRUTURA DA ESTUFA (benefício) ═══ */}
      <Secao id="estrutura" bg="bege">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <h2 className="text-primary text-2xl sm:text-3xl font-bold">
              Estrutura pensada para saúde e <span className="text-secondary">estabilidade</span>
            </h2>
            <p className="text-text font-light text-lg leading-relaxed">
              Nossa estufa em Guarapari foi projetada para até 30 mil litros de
              água somando aquários e caixas, sucedendo a primeira estufa de cerca
              de 5 mil litros. O foco é estabilidade e bem-estar: filtragem
              natural, biologia equilibrada e manejo diário para manter os guppies
              em ótimas condições antes do envio.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {estrutura.map((e) => (
                <li key={e.titulo} className="flex items-center gap-3 rounded-2xl bg-white border border-border/60 p-3.5">
                  <span className="shrink-0 grid place-items-center w-10 h-10 rounded-full bg-secondary/10 text-secondary">
                    <Icone name={e.icon} className="w-5 h-5" />
                  </span>
                  <span className="text-sm font-medium text-primary leading-snug">{e.titulo}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Figura
              src={`${IMG}/pai-construindo-estufa.webp`}
              alt="A construção da estufa nova da Marchezi Guppy Farm em Guarapari"
              ratio="1 / 1"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            <Figura
              src={`${IMG}/construcao-tanques.png`}
              alt="Construção e ampliação dos tanques da nova estufa em Guarapari"
              ratio="1 / 1"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            <Figura
              src={`${IMG}/estufa-nova-prateleiras.png`}
              alt="Estufa nova com prateleiras de tanques para a criação de guppies de linhagem"
              ratio="2 / 1"
              sizes="(max-width: 768px) 100vw, 50vw"
              className="col-span-2"
            />
          </div>
        </div>
      </Secao>

      {/* ═══ 7. POR QUE NOSSOS GUPPIES SE DESTACAM (benefícios) ═══ */}
      <Secao bg="white">
        <h2 className="text-primary text-2xl sm:text-3xl font-bold mb-8">
          Por que nossos peixes se <span className="text-secondary">destacam</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {beneficios.map((b) => (
            <div key={b.titulo} className="rounded-[22px] border border-border bg-white p-6 shadow-sm space-y-3">
              <span className="grid place-items-center w-12 h-12 rounded-full bg-secondary/10 text-secondary">
                <Icone name={b.icon} className="w-6 h-6" />
              </span>
              <h3 className="text-primary font-bold text-lg">{b.titulo}</h3>
              <p className="text-text/80 font-light leading-relaxed">{b.texto}</p>
            </div>
          ))}
        </div>
      </Secao>

      {/* ═══ 8. RECONHECIMENTO DA MÍDIA ═══ */}
      <Secao bg="bege">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-bold">
            Destaque n&rsquo;<span className="text-secondary">A Tribuna</span>
          </h2>
          <p className="text-text font-light text-lg leading-relaxed">
            O trabalho da Marchezi Guppy Farm foi destaque n&rsquo;A Tribuna, o
            maior jornal do Espírito Santo e um dos principais do Brasil. A
            reportagem mostrou a dedicação da família e o cuidado de criar peixes
            de linhagem.
          </p>
        </div>
        {/* Matéria INTEIRA e legível (object-contain) em moldura tipo recorte. */}
        <figure className="max-w-md mx-auto mt-8">
          <div className="bg-white p-2.5 rounded-2xl shadow-lg ring-1 ring-black/5">
            <div className="relative w-full overflow-hidden rounded-md bg-white" style={{ aspectRatio: "1440 / 1793" }}>
              <Image
                src={`${IMG}/materia-jornal.jpg`}
                alt="Reportagem sobre a Marchezi Guppy Farm no jornal A Tribuna"
                fill
                sizes="(max-width: 768px) 90vw, 420px"
                className="object-contain"
              />
            </div>
          </div>
        </figure>
      </Secao>

      {/* ═══ 9. AMIZADES E ADMIRAÇÃO (rede — Brasil, tom de respeito entre pares) ═══ */}
      {/* Oculta até aprovação das imagens dos retratados (MOSTRAR_AMIZADES). */}
      {MOSTRAR_AMIZADES && (
      <Secao bg="white">
        <div className="max-w-3xl space-y-4 mb-8">
          <h2 className="text-primary text-2xl sm:text-3xl font-bold">
            Amizades e admiração no mundo do <span className="text-secondary">guppy</span>
          </h2>
          <p className="text-text font-light text-lg leading-relaxed">
            O mundo do guppy é feito de gente, e ao longo da nossa caminhada
            construímos amizades e trocas saudáveis com criadores que admiramos.
            Entre eles, Rodrigo Ziviani, presidente da World Guppy Association;
            Mário Garcia e Léia, da UNAQUA, em Belo Horizonte — pessoas de visão por
            quem temos grande admiração; e o professor Mauro Schettino e o Sr.
            Abdala, referências de caráter e de qualidade técnica. São encontros e
            amizades que tornam o hobby maior.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Figura
            src={`${IMG}/visita-ziviani.webp`}
            alt="Encontro com Rodrigo Ziviani, presidente da World Guppy Association, na estufa da família em Guarapari"
            ratio="1 / 1"
            sizes="(max-width: 768px) 100vw, 25vw"
            caption="Com Rodrigo Ziviani — World Guppy Association"
          />
          <Figura
            src={`${IMG}/visita-unaqua.png`}
            alt="Encontro com Mário Garcia e Léia, da UNAQUA, em Belo Horizonte"
            ratio="1 / 1"
            sizes="(max-width: 768px) 100vw, 25vw"
            caption="Com a UNAQUA — Belo Horizonte"
          />
          <Figura
            src={`${IMG}/mestre-mauro.png`}
            alt="Encontro com o professor Mauro Schettino, referência em alimentação viva para peixes"
            ratio="1 / 1"
            sizes="(max-width: 768px) 100vw, 25vw"
            caption="Com o prof. Mauro Schettino"
          />
          <Figura
            src={`${IMG}/elias-abdalla.png`}
            alt="Encontro com o Sr. Abdala, referência de caráter e qualidade técnica no guppy brasileiro"
            ratio="1 / 1"
            sizes="(max-width: 768px) 100vw, 25vw"
            caption="Com o Sr. Abdala"
          />
        </div>
      </Secao>
      )}

      {/* ═══ 10. ENVIO COM CUIDADO ═══ */}
      {/* Fundo segue a alternância: bege quando a seção 9 aparece; senão branco. */}
      <Secao bg={MOSTRAR_AMIZADES ? "bege" : "white"}>
        <div className="max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-bold">
            Envio com cuidado para todo o <span className="text-secondary">Brasil</span>
          </h2>
          <p className="text-text font-light text-lg leading-relaxed">
            Cada peixe é observado antes de viajar e embalado à mão pela própria
            família, com atenção ao transporte de peixes ornamentais. Consulte
            prazos e regras na nossa página de frete, ou fale com a gente no
            WhatsApp.
          </p>
          <a
            href="https://www.instagram.com/reel/Cl4d8gWJX6t/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-primary hover:text-secondary transition-colors"
          >
            Ver o vídeo
            <ArrowRight size={15} aria-hidden="true" />
          </a>

          {/* SLOT GARANTIA: se o dono oferecer garantia de chegada viva, colar AQUI
              os termos exatos. Sem termos confirmados, NÃO afirmar garantia. */}

          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/frete" className={btnPrimario}>
              Calcular frete
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={btnSecundario}>
              <WhatsAppIcon className="w-5 h-5" />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </Secao>

      {/* ═══ 11. CTA FINAL ═══ */}
      <Secao bg="navy">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold">
            Pronto para escolher seus próximos guppies?
          </h2>
          <p className="text-white/85 font-light text-lg leading-relaxed">
            Conheça os exemplares disponíveis e leve para o seu aquário peixes
            criados com seleção, cuidado e história.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all"
            >
              Ver peixes disponíveis
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-white/70 text-white font-semibold hover:bg-white/10 transition-all"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Chamar no WhatsApp
            </a>
          </div>
        </div>
      </Secao>

      {/* ═══ 12. ACOMPANHE O DIA A DIA ═══ */}
      <Secao bg="white">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-bold">
            Acompanhe a estufa por dentro
          </h2>
          <p className="text-text font-light text-lg leading-relaxed">
            Mostramos a criação de verdade, todo dia.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={REDES.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all"
            >
              <IconYoutube size={20} />
              YouTube
            </a>
            <a
              href={REDES.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all"
            >
              <IconInstagram size={20} />
              Instagram
            </a>
          </div>
        </div>
      </Secao>
    </>
  );
}
