import Image from "next/image";
import Link from "next/link";
import CtaWhatsapp from "@/components/site/CtaWhatsapp";
import { HeroSection } from "@/components/site/HeroSection";
import SectionHeader from "@/components/home/SectionHeader";
import CategoryCard from "@/components/home/CategoryCard";
import ProductGrid from "@/components/home/ProductGrid";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import { CATEGORIES } from "@/lib/home-content";
import {
  getDestaques,
  getUltimosAdicionados,
  getCasais,
} from "@/lib/queries/products";

// HeroSection e as seções de produto consultam o banco. force-dynamic faz a
// query rodar em request-time (DATABASE_URL não existe no build do CapRover) e,
// de quebra, a home sempre reflete o que foi cadastrado/editado no admin —
// sem cache stale (revalidação imediata). As actions de produto também chamam
// revalidatePath("/") como reforço explícito.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [destaques, ultimos, casais] = await Promise.all([
    getDestaques(),
    getUltimosAdicionados(),
    getCasais(),
  ]);

  return (
    <>
      {/* ── Seção 1: Hero ── */}
      <HeroSection />

      {/* ── Seção 2: Principais Categorias ── */}
      <section className="bg-white py-20">
        <div className="container-site space-y-10">
          <SectionHeader
            title="Principais"
            highlight="Categorias"
            subtitle="Guppys exclusivos, exóticos e raros! Só na Guppy de Linhagem!"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CATEGORIES.map((cat) => (
              <CategoryCard key={cat.slug} category={cat} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Seção 3: Mais Procurados ── */}
      {destaques.length > 0 && (
        <section className="bg-[#ECE7E8]/40 py-16">
          <div className="container-site">
            <ProductGrid
              title="Mais"
              highlight="Procurados"
              products={destaques}
              verTudoHref="/loja?categoria=peixes-de-linhagem"
            />
          </div>
        </section>
      )}

      {/* ── Seção 4: Últimos Adicionados ── */}
      {ultimos.length > 0 && (
        <section className="bg-white py-16">
          <div className="container-site">
            <ProductGrid
              title="Últimos"
              highlight="Adicionados"
              products={ultimos}
              verTudoHref="/loja"
            />
          </div>
        </section>
      )}

      {/* ── Seção 5: História de Vitórias + Aprenda Sobre ── */}
      <section className="bg-white py-20">
        <div className="container-site">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Card escuro — História de Vitórias (60%) */}
            <div className="md:col-span-3 relative rounded-[20px] overflow-hidden flex flex-col justify-end p-10 min-h-[400px]">
              <Image
                src="/assets/home/vitorias-bg.jpg"
                alt=""
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 60vw"
                aria-hidden="true"
              />
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
                  História de{" "}
                  <span className="text-secondary">Vitórias</span> e{" "}
                  <span className="text-secondary">Guppys Campeões</span>
                </h2>
                <p className="text-white/90 font-light text-sm leading-relaxed max-w-md">
                  Nossa trajetória é marcada por{" "}
                  <strong className="font-medium text-white">dedicação, excelência em genética e conquistas em competições</strong>.
                  Conheça a história por trás da criação que transforma paixão em guppys premiados.
                </p>
                <Link
                  href="/sobre-nos"
                  className="inline-block bg-accent text-[#302f2f] font-semibold px-6 py-2.5 rounded-pill hover:brightness-95 transition-all text-sm"
                >
                  Saiba Mais
                </Link>
              </div>
            </div>

            {/* Card rosa — Aprenda Sobre (40%) */}
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
                <p className="text-white/80 text-sm font-light">Sobre os Guppy</p>
                <h3 className="text-white text-2xl font-semibold leading-snug">
                  Aprenda Sobre, Como Criar e Mais!
                </h3>
                <Link
                  href="/conheca-os-guppy"
                  className="inline-block border-2 border-white text-white font-semibold px-6 py-2.5 rounded-pill hover:bg-white/10 transition-all text-sm"
                >
                  Conhecer
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Seção 6: Casais de Guppy ── */}
      {casais.length > 0 && (
        <section className="bg-[#ECE7E8]/40 py-16">
          <div className="container-site">
            <ProductGrid
              title="Casais de"
              highlight="Guppy"
              products={casais}
              verTudoHref="/loja?categoria=casais"
            />
          </div>
        </section>
      )}

      {/* ── Seção 7: Avaliações de Clientes ── */}
      <TestimonialsSection />

      {/* ── CTA WhatsApp ── */}
      <CtaWhatsapp />
    </>
  );
}
