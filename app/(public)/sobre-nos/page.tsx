import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Award, ArrowRight, ExternalLink } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_URL } from "@/lib/constants";
import { conquistas, REDES } from "@/lib/sobre-content";

export const metadata: Metadata = {
  title: "Sobre Nós — Marchezi Guppy Farm | Linhagem tricampeã mundial",
  description:
    "Criação familiar de guppies de linhagem em Guarapari, Espírito Santo. Três gerações da família Marchezi e uma linha Full Black tricampeã mundial.",
  alternates: { canonical: "/sobre-nos" },
};

const IMG = "/images/sobrenos";

// Ícones de marca (lucide-react aposentou os brand icons) — SVG próprio, mesmo
// padrão da Navbar. currentColor herda a cor do botão.
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

// Foto com proporção NATURAL da imagem (aspectRatio = ratio real) → object-cover
// preenche sem cortar conteúdo/rostos. Legenda opcional com faixa de contraste.
function Figura({
  src,
  alt,
  ratio,
  caption,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className = "",
}: {
  src: string;
  alt: string;
  ratio: string; // ex.: "1440 / 1784"
  caption?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <figure
      className={`relative w-full overflow-hidden rounded-2xl shadow-sm bg-bg-alt/60 ${className}`}
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

export default function SobreNosPage() {
  // JSON-LD (GEO): AboutPage → Organization; prêmios montados dos dados confirmados.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Sobre a Marchezi Guppy Farm",
    mainEntity: {
      "@type": "Organization",
      name: "Marchezi Guppy Farm",
      description:
        "Criação familiar de guppies de linhagem em Guarapari, Espírito Santo, com linhas premiadas em campeonatos mundiais.",
      founder: { "@type": "Person", name: "Manassés Marchezi" },
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

      {/* ═══════ MOVIMENTO 1 — ABERTURA: O CORAÇÃO ═══════ */}
      <section className="bg-white">
        <div className="container-site py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-widest">
                <Trophy size={16} aria-hidden="true" />
                Marchezi Guppy Farm
              </span>
              <h1 className="text-primary text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                Três gerações. Uma linhagem{" "}
                <span className="text-secondary">tricampeã mundial</span>.
              </h1>
              <p className="text-text font-light text-lg leading-relaxed">
                Uma paixão que atravessa o tempo e passou de pai para filho — e
                agora para a neta. O que começou na beira da água, em Guarapari,
                no Espírito Santo, virou uma criação familiar de guppies de
                linhagem reconhecida no mundo inteiro.
              </p>
            </div>
            <Figura
              src={`${IMG}/tres-geracoes.jpg`}
              alt="Três gerações da família Marchezi — avô Vanderli, Manassés e a neta Sarah — juntos na criação de guppies em Guarapari"
              ratio="1440 / 1784"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="max-w-md mx-auto lg:max-w-none"
            />
          </div>
        </div>
      </section>

      {/* ═══════ MOVIMENTO 2 — A JORNADA: DE ONDE VEIO ═══════ */}
      <section className="bg-bg-alt/40">
        <div className="container-site py-14 sm:py-20 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
                Começou na <span className="text-secondary">beira da água</span>
              </h2>
              <p className="text-text font-light leading-relaxed">
                Tudo começou às margens das lagoas, riachos e praias do Espírito
                Santo. Foi o pai, Vanderli José Marchezi, quem levou Manassés para
                pescar pela primeira vez, por volta dos seis anos — e ali nasceu
                uma paixão pela água que nunca mais o deixou.
              </p>
              <p className="text-text font-light leading-relaxed">
                Hoje essa mesma paixão já alcança a terceira geração: Sarah, filha
                de Manassés, cresce entre os aquários e explora as pedras e
                pequenas lagoas de Guarapari, como o pai fez com o avô. Uma
                história que rendeu até reportagem na imprensa local sobre o
                cuidado de criar peixes.
              </p>
            </div>
            <Figura
              src={`${IMG}/sarah-aquarios.jpg`}
              alt="Sarah, filha de Manassés e terceira geração da família, entre os aquários da criação"
              ratio="1440 / 1784"
              className="max-w-sm mx-auto md:max-w-none"
            />
          </div>

          {/* Matéria de jornal — INTEIRA e legível (object-contain), estilo recorte. */}
          <figure className="max-w-md mx-auto">
            <div className="bg-white p-2.5 rounded-xl shadow-lg ring-1 ring-black/5">
              <div
                className="relative w-full overflow-hidden rounded-md bg-white"
                style={{ aspectRatio: "1440 / 1793" }}
              >
                <Image
                  src={`${IMG}/materia-jornal.jpg`}
                  alt="Reportagem da imprensa local do Espírito Santo sobre a família Marchezi e a criação de guppies"
                  fill
                  sizes="(max-width: 768px) 90vw, 420px"
                  className="object-contain"
                />
              </div>
            </div>
            <figcaption className="mt-3 text-center text-xs text-text/70">
              Matéria na imprensa local do Espírito Santo
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ═══════ MOVIMENTO 3 — A CONSAGRAÇÃO: ONDE CHEGOU (pico) ═══════ */}
      <section className="bg-white">
        <div className="container-site py-16 sm:py-24">
          <div className="max-w-2xl mx-auto text-center space-y-5">
            <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-widest">
              De admirador a campeão
            </span>
            <h2 className="text-primary text-2xl sm:text-4xl font-bold leading-tight">
              O menino que admirava os campeões{" "}
              <span className="text-secondary">virou um deles</span>.
            </h2>
            <p className="text-text font-light text-lg leading-relaxed">
              Ainda adolescente, nos anos 90, Manassés se encantou com as
              primeiras páginas de criadores de guppy que via na internet — entre
              elas, as de Rodrigo Ziviani, hoje vice-presidente da World Guppy
              Association. Criar peixes daquele nível parecia um sonho distante.
              Décadas depois, em 2021, foi esse mesmo Rodrigo Ziviani quem visitou
              a estufa da família em Guarapari.
            </p>
          </div>
          <div className="mt-10 max-w-2xl mx-auto">
            <Figura
              src={`${IMG}/visita-ziviani.png`}
              alt="Rodrigo Ziviani, vice-presidente da World Guppy Association, visitando a estufa da família Marchezi em Guarapari, 2021"
              ratio="873 / 795"
              sizes="(max-width: 768px) 100vw, 640px"
              caption="Visita de Rodrigo Ziviani à estufa da família — Guarapari, 2021"
            />
          </div>
        </div>
      </section>

      {/* ═══════ MOVIMENTO 4 — A PROVA: AUTORIDADE ═══════ */}
      {/* 4a — Os três títulos mundiais */}
      <section className="bg-bg-alt/40">
        <div className="container-site py-14 sm:py-20 space-y-10">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-widest">
              <Award size={16} aria-hidden="true" />
              Reconhecimento
            </span>
            <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
              Do Espírito Santo para o <span className="text-secondary">mundo</span>
            </h2>
            <p className="text-text font-light leading-relaxed">
              Nosso trabalho começou a se destacar no cenário internacional do
              guppy. A cada ano, nossas linhagens representam o Brasil — pela
              Brazilian Guppy Association — nos campeonatos mundiais.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {conquistas.map((c) => (
              <article
                key={c.linha}
                className={`rounded-2xl border p-6 flex flex-col gap-3 ${
                  c.destaque
                    ? "border-secondary bg-secondary/5 shadow-sm ring-1 ring-secondary/20"
                    : "border-border bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Trophy size={20} className={c.destaque ? "text-secondary" : "text-accent"} aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.titulo}
                  </span>
                </div>
                <h3 className={`font-bold leading-tight text-primary ${c.destaque ? "text-2xl" : "text-xl"}`}>
                  {c.linha}
                </h3>
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
        </div>
      </section>

      {/* 4b — Quando o hobby virou criação (expansão da estufa) */}
      <section className="bg-white">
        <div className="container-site py-14 sm:py-20 space-y-8">
          <div className="max-w-3xl space-y-4">
            <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
              Quando o hobby virou <span className="text-secondary">criação</span>
            </h2>
            <p className="text-text font-light leading-relaxed">
              Por muitos anos, a criação foi um hobby de família. Isso mudou entre
              2023 e 2024: construímos uma estufa nova, ampliamos a estrutura para
              dezenas de tanques e ganhamos um novo sócio, Vinícius Pirovani. O que
              era paixão se tornou criação séria, com seleção genética rigorosa e
              cuidado diário em cada tanque.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">
            <Figura
              src={`${IMG}/pai-construindo-estufa.png`}
              alt="Vanderli, pai de Manassés, construindo a estufa nova da criação em Guarapari"
              ratio="889 / 893"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
            <Figura
              src={`${IMG}/construcao-tanques.png`}
              alt="Construção e ampliação dos tanques da nova estufa da Marchezi Guppy Farm"
              ratio="492 / 731"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
            <Figura
              src={`${IMG}/estufa-nova-prateleiras.png`}
              alt="Estufa nova com prateleiras de tanques para a criação de guppies de linhagem"
              ratio="895 / 504"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
          </div>
        </div>
      </section>

      {/* 4c — Autoridade técnica: método (Schettino) + rede (UNAQUA/Elias) */}
      <section className="bg-bg-alt/40">
        <div className="container-site py-14 sm:py-20 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <Figura
              src={`${IMG}/mestre-mauro.png`}
              alt="Manassés com o professor Mauro Schettino, referência em alimentação viva para peixes"
              ratio="891 / 882"
              caption="Com o professor Mauro Schettino — estudo de alimentação viva"
              className="max-w-md mx-auto md:max-w-none"
            />
            <div className="space-y-4">
              <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
                Por que nossos peixes se <span className="text-secondary">destacam</span>
              </h2>
              <p className="text-text font-light leading-relaxed">
                Cor e saúde não acontecem por acaso. Parte do nosso diferencial
                está na alimentação viva — técnica que Manassés estudou com o
                professor Mauro Schettino, referência no assunto — somada a um
                ambiente de criação com filtragem natural e biologia estável. E
                quando o seu peixe vai viajar, é a própria família que seleciona e
                embala cada exemplar à mão, com o cuidado de quem quer que ele
                chegue vivo e perfeito na sua casa.
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
            </div>
          </div>

          {/* Rede — máx. 2 fotos, rotuladas como VISITA/encontro (≠ instalação própria). */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <p className="text-text font-light leading-relaxed">
              Ao longo do caminho, trocamos experiência com grandes nomes do guppy
              brasileiro, como os criadores e dirigentes da UNAQUA, em Belo
              Horizonte.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Figura
                src={`${IMG}/visita-unaqua.png`}
                alt="Encontro com os dirigentes da UNAQUA em Belo Horizonte"
                ratio="893 / 769"
                sizes="(max-width: 768px) 50vw, 25vw"
                caption="Visita à UNAQUA — Belo Horizonte (não é a nossa estufa)"
              />
              <Figura
                src={`${IMG}/elias-abdalla.png`}
                alt="Encontro com Elias Abdalla, nome de referência no guppy brasileiro"
                ratio="894 / 889"
                sizes="(max-width: 768px) 50vw, 25vw"
                caption="Encontro com Elias Abdalla"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ MOVIMENTO 5 — O CONVITE ═══════ */}
      <section className="bg-primary text-white">
        <div className="container-site py-16 sm:py-20 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-semibold">Acompanhe a estufa por dentro</h2>
          <p className="text-white/85 font-light max-w-2xl mx-auto leading-relaxed">
            Mostramos a criação de verdade, todo dia. Acompanhe o canal no YouTube
            e o Instagram para ver os bastidores, as linhagens e o dia a dia da
            estufa.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={REDES.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-11 bg-white text-primary font-semibold px-7 py-3 rounded-pill hover:bg-accent hover:text-[#302f2f] transition-all"
            >
              <IconYoutube size={20} />
              YouTube
            </a>
            <a
              href={REDES.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-11 border-2 border-white/70 text-white font-semibold px-7 py-3 rounded-pill hover:bg-white/10 transition-all"
            >
              <IconInstagram size={20} />
              Instagram
            </a>
          </div>

          <div className="pt-6 mt-2 border-t border-white/15 max-w-2xl mx-auto space-y-4">
            <p className="text-white/85 font-light leading-relaxed">
              Se a história te conquistou, conheça os peixes que ela produz.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 min-h-11 bg-secondary text-white font-semibold px-7 py-3 rounded-pill hover:brightness-110 transition-all"
              >
                Conheça os guppys disponíveis
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-11 border-2 border-white/70 text-white font-semibold px-7 py-3 rounded-pill hover:bg-white/10 transition-all"
              >
                <WhatsAppIcon className="w-5 h-5" />
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
