import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HeroSection } from "@/components/site/HeroSection";
import TrustBar from "@/components/site/TrustBar";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import LojaListing from "@/components/product/LojaListing";
import {
  listProductsLoja,
  type LojaOrdenacao,
} from "@/lib/queries/products";
import { listCategories } from "@/lib/queries/categories";
import { HOME_BANNERS } from "@/lib/home-content";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { onlineStoreJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { WHATSAPP_PHONE } from "@/lib/constants";

export const metadata: Metadata = pageMeta({
  title: "Guppy de Linhagem (Lebiste) — Criação Tricampeã Mundial",
  description:
    "Guppys (lebistes) de linhagem do tricampeão mundial Full Black. Full Red, Koi, Half Moon e mais — envio de peixe vivo para todo o Brasil, de Guarapari/ES.",
  path: "/",
  image: {
    url: "/images/hero/blue-dragon-hero.webp",
    width: 1024,
    height: 1024,
    alt: "Guppy de linhagem premiado da Marchezi Guppy Farm",
  },
});

// OnlineStore JSON-LD (GEO) na home — MESMA entidade de /sobre-nos (mesmo @id,
// name, sameAs e award), apresentada como loja. Dados confirmados em
// lib/sobre-content; WhatsApp em E.164 a partir de lib/constants. Sem inventar.
const storeJsonLd = onlineStoreJsonLd(SITE_URL, {
  whatsappE164: `+${WHATSAPP_PHONE}`,
});

// A home é a vitrine: lê o banco e os filtros da URL em request-time. Mantém o
// frescor imediato do que o admin cadastra/edita (sem cache stale).
export const dynamic = "force-dynamic";

const ORDENS = new Set<LojaOrdenacao>([
  "recentes",
  "menor-preco",
  "maior-preco",
]);

type Props = {
  searchParams: Promise<{
    busca?: string;
    categoria?: string;
    ordem?: string;
  }>;
};

export default async function HomePage({ searchParams }: Props) {
  const sp = await searchParams;
  const busca = typeof sp.busca === "string" ? sp.busca : "";
  const categoria =
    typeof sp.categoria === "string" && sp.categoria ? sp.categoria : "todos";
  const ordem: LojaOrdenacao =
    typeof sp.ordem === "string" && ORDENS.has(sp.ordem as LojaOrdenacao)
      ? (sp.ordem as LojaOrdenacao)
      : "recentes";

  const [{ items, total }, categorias] = await Promise.all([
    listProductsLoja({ busca, categoriaSlug: categoria, ordenacao: ordem }),
    listCategories(),
  ]);

  const { estufa: banner1, aprenda: banner2 } = HOME_BANNERS;

  return (
    <>
      {/* OnlineStore JSON-LD (GEO) */}
      <JsonLd data={storeJsonLd} />

      {/* ── Hero ── */}
      <HeroSection />

      {/* ── Barra de confiança: faixa própria (clara), separada do hero ── */}
      <TrustBar />

      {/* ── A loja (vitrine): busca + filtros + grade. Âncora do menu/hero. ── */}
      <section id="loja" className="scroll-mt-24 bg-white">
        <LojaListing
          initialItems={items}
          total={total}
          categorias={categorias.map((c) => ({ slug: c.slug, nome: c.nome }))}
          busca={busca}
          categoria={categoria}
          ordem={ordem}
        />
      </section>

      {/* ── Avaliações de Clientes (oculta enquanto não há reviews reais) ── */}
      <TestimonialsSection />

      {/* ── Conteúdo secundário: 2 banners 2-up (estufa/cuidado + aprenda) ── */}
      <section className="bg-white py-20">
        <div className="container-site">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Banner 1 — estufa/cuidado (escuro, 60%) */}
            <div className="md:col-span-3 relative rounded-[20px] overflow-hidden flex flex-col justify-end p-10 min-h-[400px]">
              {banner1.imagem && (
                <Image
                  src={banner1.imagem}
                  alt=""
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 768px) 100vw, 60vw"
                  aria-hidden="true"
                />
              )}
              <div className="absolute inset-0 bg-primary/70" />
              <div
                className="absolute top-6 right-6 w-24 h-24 opacity-20 pointer-events-none z-10"
                style={{
                  backgroundImage: "radial-gradient(#FAB82A 2px, transparent 2px)",
                  backgroundSize: "14px 14px",
                }}
              />
              <div className="relative z-10 space-y-4">
                <h2 className="text-white text-2xl sm:text-3xl font-semibold leading-snug">
                  {banner1.tituloPartes.map((parte, i) => (
                    <span
                      key={i}
                      className={parte.realce ? "text-secondary" : undefined}
                    >
                      {parte.texto}
                    </span>
                  ))}
                </h2>
                {banner1.subtitulo && (
                  <p className="text-white/90 font-light text-sm leading-relaxed max-w-md">
                    {banner1.subtitulo}
                  </p>
                )}
                <Link
                  href={banner1.ctaHref}
                  className="inline-block bg-accent text-[#302f2f] font-semibold px-6 py-2.5 rounded-pill hover:brightness-95 transition-all text-sm"
                >
                  {banner1.ctaLabel}
                </Link>
              </div>
            </div>

            {/* Banner 2 — aprenda (rosa, 40%) */}
            <div className="md:col-span-2 relative bg-secondary rounded-[20px] overflow-hidden flex flex-col justify-end p-10 min-h-[400px]">
              <div
                className="absolute top-6 right-6 w-24 h-24 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(#FAB82A 2px, transparent 2px)",
                  backgroundSize: "14px 14px",
                }}
              />
              <svg
                className="absolute top-8 right-8 opacity-30 pointer-events-none rotate-12"
                width="64" height="40" viewBox="0 0 64 40" fill="none"
                aria-hidden="true"
              >
                <path d="M2 20 C8 8, 20 4, 32 8 C44 12, 54 10, 62 4 C58 14, 58 26, 62 36 C54 30, 44 28, 32 32 C20 36, 8 32, 2 20Z" fill="#000" />
                <path d="M62 4 L56 12 L62 20 Z" fill="#000" />
              </svg>
              <svg
                className="absolute top-24 right-4 opacity-25 pointer-events-none -rotate-6"
                width="44" height="28" viewBox="0 0 64 40" fill="none"
                aria-hidden="true"
              >
                <path d="M2 20 C8 8, 20 4, 32 8 C44 12, 54 10, 62 4 C58 14, 58 26, 62 36 C54 30, 44 28, 32 32 C20 36, 8 32, 2 20Z" fill="#000" />
                <path d="M62 4 L56 12 L62 20 Z" fill="#000" />
              </svg>
              <div className="relative z-10 space-y-4">
                {banner2.eyebrow && (
                  <p className="text-white/80 text-sm font-light">
                    {banner2.eyebrow}
                  </p>
                )}
                <h3 className="text-white text-2xl font-semibold leading-snug">
                  {banner2.tituloPartes.map((parte) => parte.texto).join("")}
                </h3>
                <Link
                  href={banner2.ctaHref}
                  className="inline-block border-2 border-white text-white font-semibold px-6 py-2.5 rounded-pill hover:bg-white/10 transition-all text-sm"
                >
                  {banner2.ctaLabel}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Texto institucional (SEO/GEO): apresenta o site em texto real, com
          os termos que as pessoas pesquisam (guppy e lebiste) e links internos
          contextuais para as linhagens, o guia e a história. ── */}
      <section className="bg-bg-alt py-16">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Guppy de linhagem, também chamado de{" "}
            <span className="text-secondary">lebiste</span>
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppy e lebiste são o mesmo peixe (<em>Poecilia reticulata</em>). Aqui
            na Marchezi Guppy Farm eu crio guppy de linhagem em Guarapari, no
            Espírito Santo, numa estufa feita só para isso. São anos de seleção,
            geração após geração, o mesmo trabalho que rendeu o tricampeonato
            mundial na linha{" "}
            <Link href="/?busca=full+black" className="text-secondary font-medium hover:underline">
              Full Black
            </Link>{" "}
            no World Guppy Contest.
          </p>
          <p className="text-text font-light leading-relaxed">
            Trabalho com casais e trios das{" "}
            <Link href="/linhagens" className="text-secondary font-medium hover:underline">
              linhagens
            </Link>{" "}
            que a gente desenvolve, como{" "}
            <Link href="/?busca=full+red" className="text-secondary font-medium hover:underline">
              Full Red
            </Link>
            ,{" "}
            <Link href="/?busca=koi" className="text-secondary font-medium hover:underline">
              Koi
            </Link>{" "}
            e{" "}
            <Link href="/?busca=half+moon" className="text-secondary font-medium hover:underline">
              Half Moon
            </Link>
            . Cada peixe é observado antes de viajar e embalado à mão para chegar
            vivo e no padrão, com envio para todo o Brasil. Para entender melhor o
            hobby, veja o{" "}
            <Link href="/peixe-guppy" className="text-secondary font-medium hover:underline">
              guia do guppy
            </Link>{" "}
            ou conheça a{" "}
            <Link href="/sobre-nos" className="text-secondary font-medium hover:underline">
              nossa história
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
