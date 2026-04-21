import Image from "next/image";
import Link from "next/link";
import { Truck, Trophy, Package, HeartHandshake } from "lucide-react";
import WaveDivider from "@/components/site/WaveDivider";
import CtaWhatsapp from "@/components/site/CtaWhatsapp";
import SectionHeader from "@/components/home/SectionHeader";
import CategoryCard from "@/components/home/CategoryCard";
import ProductGrid from "@/components/home/ProductGrid";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import { CATEGORIES, PRODUCTS_MOCK } from "@/lib/mock-data";

const DIFERENCIAIS = [
  {
    icon: <Truck size={40} className="text-accent" />,
    titulo: "Envio Nacional",
    descricao: "Envio para todo o Brasil",
  },
  {
    icon: <Trophy size={40} className="text-accent" />,
    titulo: "Linhagem Pura",
    descricao: "Peixes Premiados",
  },
  {
    icon: <Package size={40} className="text-accent" />,
    titulo: "Envio Seguro",
    descricao: "Pensado na Saúde do Animal",
  },
  {
    icon: <HeartHandshake size={40} className="text-accent" />,
    titulo: "Suporte e Direcionamento",
    descricao: "Suporte via Whats com Profissional",
  },
];

export default function HomePage() {
  const destaques = PRODUCTS_MOCK.filter((p) => p.destaque);
  const casais = PRODUCTS_MOCK.filter((p) => p.categoria === "casais");

  return (
    <>
      {/* Wave superior — navbar branca → hero bg-alt */}
      <WaveDivider fill="#ECE7E8" flip />

      {/* ── Seção 1: Hero ── */}
      <section className="bg-[#ECE7E8] relative overflow-hidden">
        <div className="container-site py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">

            {/* Coluna esquerda — texto */}
            <div className="space-y-6 order-2 md:order-1">
              <div className="space-y-2">
                <h3 className="text-xl font-medium text-text">
                  Seu Guppy{" "}
                  <span className="text-accent font-semibold">Novo Aqui!</span>
                </h3>
                <h1 className="relative text-primary font-bold leading-tight inline-block">
                  Guppys de{" "}
                  <span className="relative text-secondary">
                    <span
                      className="absolute -inset-y-1 -inset-x-3 opacity-40 pointer-events-none"
                      style={{
                        backgroundImage: "radial-gradient(#FF035C 1.5px, transparent 1.5px)",
                        backgroundSize: "10px 10px",
                        borderRadius: "50%",
                        zIndex: 0,
                      }}
                      aria-hidden="true"
                    />
                    <span className="relative z-10">Linhagem</span>
                  </span>
                </h1>
              </div>
              <p className="text-text font-light text-base leading-relaxed max-w-md">
                Peixes selecionados, saudáveis e com genética apurada para aquaristas exigentes.{" "}
                <strong className="font-medium">Transforme seu aquário com beleza, qualidade e vitalidade.</strong>{" "}
                💧 Envio seguro para todo o Brasil!
              </p>
              <Link
                href="/loja"
                className="inline-block bg-primary text-white font-semibold px-8 py-3.5 rounded-pill hover:bg-accent hover:text-[#302f2f] transition-all text-base"
              >
                Ver Loja
              </Link>
            </div>

            {/* Coluna direita — foto do peixe com blob */}
            <div className="order-1 md:order-2 flex justify-center md:justify-end">
              <div className="relative w-[320px] h-[320px] md:w-[420px] md:h-[420px]">
                <Image
                  src="/assets/home/hero-fish.png"
                  alt="Guppy de linhagem premium"
                  fill
                  priority
                  className="object-cover rounded-[50%_30%_60%_40%_/_40%_60%_30%_50%]"
                  sizes="(max-width: 768px) 320px, 420px"
                />
              </div>
            </div>

          </div>
        </div>
        <WaveDivider fill="#ffffff" />
      </section>

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

      {/* ── Seção 4: Últimos Adicionados ── */}
      <section className="bg-white py-16">
        <div className="container-site">
          <ProductGrid
            title="Últimos"
            highlight="Adicionados"
            products={PRODUCTS_MOCK}
            verTudoHref="/loja"
          />
        </div>
      </section>

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
      <section className="bg-[#ECE7E8]/40 py-16">
        <div className="container-site">
          <ProductGrid
            title="Casais de"
            highlight="Guppy"
            products={casais.length > 0 ? casais : PRODUCTS_MOCK.slice(0, 2)}
            verTudoHref="/loja?categoria=casais"
          />
        </div>
      </section>

      {/* ── Seção 7: Avaliações de Clientes ── */}
      <TestimonialsSection />

      {/* ── Seção 8: Diferenciais ── */}
      <section className="bg-white py-16">
        <div className="container-site">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {DIFERENCIAIS.map((item) => (
              <div key={item.titulo} className="flex flex-col items-center text-center space-y-3 p-4">
                <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center">
                  {item.icon}
                </div>
                <p className="text-primary font-semibold text-base">{item.titulo}</p>
                <p className="text-muted-foreground font-light text-sm">{item.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Seção 9: CTA WhatsApp ── */}
      <CtaWhatsapp />
    </>
  );
}
