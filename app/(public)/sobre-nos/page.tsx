import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Award, ArrowRight, ExternalLink } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_URL } from "@/lib/constants";
import { conquistas, REDES } from "@/lib/sobre-content";

// Ícones de marca (lucide-react aposentou os brand icons) — SVG próprio, mesmo
// padrão da Navbar. currentColor herda a cor do botão.
function IconYoutube({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
    </svg>
  );
}

function IconInstagram({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "Sobre Nós — Marchezi Guppy Farm | Linhagem tricampeã mundial",
  description:
    "Criação familiar de guppies de linhagem em Guarapari, Espírito Santo. Três gerações da família Marchezi e uma linha Full Black tricampeã mundial.",
  alternates: { canonical: "/sobre-nos" },
};

const IMG = "/images/sobrenos";

// JSON-LD (GEO): AboutPage → Organization, com os prêmios montados a partir dos
// dados confirmados (conquistas). Sem campos inventados.
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
    award: conquistas.map(
      (c) => `${c.linha} — ${c.titulo} (${c.anos}), ${c.evento}`,
    ),
    sameAs: [REDES.youtube, REDES.instagram],
  },
};

export default function SobreNosPage() {
  return (
    <>
      {/* JSON-LD para GEO (IAs citáveis). Montado dos dados confirmados. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ═══ HERO / ABERTURA ═══ */}
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
                A Marchezi Guppy Farm é uma criação familiar de guppies de
                linhagem em Guarapari, Espírito Santo. A paixão que passou de pai
                para filho — e agora para a neta — virou trabalho sério: nossa
                linha Full Black é tricampeã mundial.
              </p>
            </div>
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-sm">
              <Image
                src={`${IMG}/tres-geracoes.jpg`}
                alt="Três gerações da família Marchezi — avô, pai e neta — juntos na criação de guppies em Guarapari"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ A RAIZ ═══ */}
      <section className="bg-bg-alt/40">
        <div className="container-site py-14 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
                Começou na <span className="text-secondary">beira da água</span>
              </h2>
              <p className="text-text font-light leading-relaxed">
                Tudo começou às margens das lagoas, riachos e praias do Espírito
                Santo. Foi o pai, Vanderli José Marchezi, quem levou Manassés para
                pescar pela primeira vez, por volta dos seis anos — e ali nasceu
                uma paixão pela água que nunca mais o deixou. Hoje essa mesma
                paixão já alcança a terceira geração: Sarah, filha de Manassés,
                cresce entre os aquários e explora as pedras e pequenas lagoas de
                Guarapari, como o pai fez com o avô. Uma história que rendeu até
                reportagem na imprensa local sobre o cuidado de criar peixes.
              </p>
            </div>
            <div className="space-y-4">
              <figure className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-sm">
                <Image
                  src={`${IMG}/materia-jornal.jpg`}
                  alt="Reportagem da imprensa local do Espírito Santo sobre a família Marchezi e a criação de guppies"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <figcaption className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-xs px-3 py-1.5">
                  Matéria na imprensa local do Espírito Santo
                </figcaption>
              </figure>
              <div className="relative aspect-[16/9] rounded-2xl overflow-hidden shadow-sm">
                <Image
                  src={`${IMG}/sarah-aquarios.jpg`}
                  alt="Sarah, filha de Manassés, entre os aquários da criação familiar"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ O SONHO ═══ */}
      <section className="bg-white">
        <div className="container-site py-14 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <figure className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-sm order-last md:order-first">
              <Image
                src={`${IMG}/visita-ziviani.png`}
                alt="Rodrigo Ziviani, vice-presidente da World Guppy Association, visitando a estufa da família Marchezi em Guarapari, 2021"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <figcaption className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-xs px-3 py-1.5">
                Visita de Rodrigo Ziviani à estufa da família — Guarapari, 2021
              </figcaption>
            </figure>
            <div className="space-y-4">
              <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
                De admirador a <span className="text-secondary">campeão</span>
              </h2>
              <p className="text-text font-light leading-relaxed">
                Ainda adolescente, nos anos 90, Manassés se encantou com as
                primeiras páginas de criadores de guppy que via na internet —
                entre elas, as de Rodrigo Ziviani, hoje vice-presidente da World
                Guppy Association. Criar peixes daquele nível parecia um sonho
                distante. Décadas depois, em 2021, foi esse mesmo Rodrigo Ziviani
                quem visitou a estufa da família em Guarapari.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ O SALTO ═══ */}
      <section className="bg-bg-alt/40">
        <div className="container-site py-14 sm:py-16 space-y-8">
          <div className="max-w-3xl space-y-4">
            <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
              Quando o hobby virou{" "}
              <span className="text-secondary">criação</span>
            </h2>
            <p className="text-text font-light leading-relaxed">
              Por muitos anos, a criação foi um hobby de família. Isso mudou entre
              2023 e 2024: construímos uma estufa nova, ampliamos a estrutura para
              dezenas de tanques e ganhamos um novo sócio, Vinícius Pirovani. O
              que era paixão se tornou criação séria, com seleção genética
              rigorosa e cuidado diário em cada tanque.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                src: "pai-construindo-estufa.png",
                alt: "Vanderli, pai de Manassés, construindo a estufa nova da criação em Guarapari",
              },
              {
                src: "construcao-tanques.png",
                alt: "Construção e ampliação dos tanques da nova estufa da Marchezi Guppy Farm",
              },
              {
                src: "estufa-nova-prateleiras.png",
                alt: "Estufa nova com prateleiras de tanques para a criação de guppies de linhagem",
              },
            ].map((g) => (
              <div
                key={g.src}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm"
              >
                <Image
                  src={`${IMG}/${g.src}`}
                  alt={g.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ RECONHECIMENTO ═══ */}
      <section className="bg-white">
        <div className="container-site py-14 sm:py-16 space-y-10">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-widest">
              <Award size={16} aria-hidden="true" />
              Reconhecimento
            </span>
            <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
              Do Espírito Santo para o{" "}
              <span className="text-secondary">mundo</span>
            </h2>
            <p className="text-text font-light leading-relaxed">
              Nosso trabalho começou a se destacar no cenário internacional do
              guppy. A cada ano, nossas linhagens representam o Brasil — pela
              Brazilian Guppy Association — nos campeonatos mundiais.
            </p>
          </div>

          {/* Cards de conquistas (fonte: lib/sobre-content). Full Black em destaque. */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {conquistas.map((c) => (
              <article
                key={c.linha}
                className={`rounded-2xl border p-6 flex flex-col gap-3 ${
                  c.destaque
                    ? "border-secondary bg-secondary/5 lg:row-span-1 shadow-sm ring-1 ring-secondary/20"
                    : "border-border bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Trophy
                    size={20}
                    className={c.destaque ? "text-secondary" : "text-accent"}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.titulo}
                  </span>
                </div>
                <h3
                  className={`font-bold leading-tight ${
                    c.destaque
                      ? "text-primary text-2xl"
                      : "text-primary text-xl"
                  }`}
                >
                  {c.linha}
                </h3>
                <p className="text-sm font-semibold text-secondary">{c.anos}</p>
                <p className="text-sm text-text/80 leading-snug">{c.evento}</p>
                <p className="text-sm text-text font-light leading-relaxed">
                  {c.nota}
                </p>
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

          {/* Fecho de rede (curto, máx. 2 fotos) — rotuladas como VISITA/ENCONTRO. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
            <p className="text-text font-light leading-relaxed">
              Ao longo do caminho, trocamos experiência com grandes nomes do
              guppy brasileiro, como os criadores e dirigentes da UNAQUA, em Belo
              Horizonte.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <figure className="relative aspect-square rounded-2xl overflow-hidden shadow-sm">
                <Image
                  src={`${IMG}/visita-unaqua.png`}
                  alt="Encontro com os dirigentes da UNAQUA em Belo Horizonte"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <figcaption className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[11px] px-2 py-1">
                  Visita à UNAQUA — Belo Horizonte (não é a nossa estufa)
                </figcaption>
              </figure>
              <figure className="relative aspect-square rounded-2xl overflow-hidden shadow-sm">
                <Image
                  src={`${IMG}/elias-abdalla.png`}
                  alt="Encontro com Elias Abdalla, nome de referência no guppy brasileiro"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <figcaption className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[11px] px-2 py-1">
                  Encontro com Elias Abdalla
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MÉTODO & CONFIANÇA ═══ */}
      <section className="bg-bg-alt/40">
        <div className="container-site py-14 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <figure className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-sm">
              <Image
                src={`${IMG}/mestre-mauro.png`}
                alt="Manassés com o professor Mauro Schettino, referência em alimentação viva para peixes"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <figcaption className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-xs px-3 py-1.5">
                Com o professor Mauro Schettino — estudo de alimentação viva
              </figcaption>
            </figure>
            <div className="space-y-5">
              <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
                Por que nossos peixes se{" "}
                <span className="text-secondary">destacam</span>
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
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 min-h-11 bg-secondary text-white font-semibold px-7 py-3 rounded-pill hover:brightness-110 transition-all"
                >
                  Ver os guppys disponíveis
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 min-h-11 border-2 border-primary text-primary font-semibold px-7 py-3 rounded-pill hover:bg-primary hover:text-white transition-all"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  Falar no WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ACOMPANHE O DIA A DIA (fechamento, antes do rodapé) ═══ */}
      <section className="bg-primary text-white">
        <div className="container-site py-14 sm:py-16 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-semibold">
            Acompanhe a estufa por dentro
          </h2>
          <p className="text-white/85 font-light max-w-2xl mx-auto leading-relaxed">
            Mostramos a criação de verdade, todo dia. Acompanhe o canal no YouTube
            e o Instagram para ver os bastidores, as linhagens e o dia a dia da
            estufa.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
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
        </div>
      </section>
    </>
  );
}
