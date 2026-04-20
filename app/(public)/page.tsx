import Image from "next/image";
import Link from "next/link";
import { Truck, Trophy, Package, HeartHandshake, Phone } from "lucide-react";
import WaveDivider from "@/components/site/WaveDivider";
import SectionHeader from "@/components/home/SectionHeader";
import CategoryCard from "@/components/home/CategoryCard";
import ProductGrid from "@/components/home/ProductGrid";
import TestimonialCard from "@/components/home/TestimonialCard";
import { CATEGORIES, PRODUCTS_MOCK, TESTIMONIALS } from "@/lib/mock-data";

function IconWhatsApp({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

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
      {/* ── Seção 1: Hero ── */}
      <section className="bg-[#ECE7E8] relative overflow-hidden">
        <div className="container-site py-16 md:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            {/* Coluna esquerda */}
            <div className="space-y-6 order-2 md:order-1">
              <div className="space-y-1">
                <h3 className="text-xl font-medium text-text">
                  Seu Guppy{" "}
                  <span className="text-accent font-semibold">Novo Aqui!</span>
                </h3>
                <h1 className="text-primary font-bold leading-tight">
                  Guppys de{" "}
                  <span className="text-secondary">Linhagem</span>
                </h1>
              </div>
              <p className="text-text font-light text-base leading-relaxed max-w-lg">
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

            {/* Coluna direita — forma orgânica verde + peixe */}
            <div className="relative order-1 md:order-2 flex justify-center md:justify-end">
              {/* Container com forma verde de fundo */}
              <div className="relative w-full max-w-sm md:max-w-md h-[400px] md:h-[480px]">
                {/* Imagem de fundo verde/habitat */}
                <Image
                  src="/assets/home/hero-background.png"
                  alt=""
                  fill
                  priority
                  className="object-contain object-center"
                  sizes="(max-width: 768px) 80vw, 40vw"
                  aria-hidden="true"
                />
                {/* Peixe principal centralizado sobre a forma */}
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <div className="relative w-full h-full">
                    <Image
                      src="/assets/home/hero-fish.png"
                      alt="Guppy de linhagem premium"
                      fill
                      priority
                      className="object-contain rounded-[50%_30%_60%_40%_/_40%_60%_30%_50%]"
                      sizes="(max-width: 768px) 70vw, 35vw"
                    />
                  </div>
                </div>
                {/* Pontilhado decorativo rosa — canto inferior direito */}
                <div
                  className="absolute bottom-2 right-2 w-24 h-24 opacity-70 z-10 pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(#FF035C 2px, transparent 2px)",
                    backgroundSize: "16px 16px",
                  }}
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
              {/* Imagem de fundo */}
              <Image
                src="/assets/home/vitorias-bg.jpg"
                alt=""
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 60vw"
                aria-hidden="true"
              />
              {/* Overlay navy */}
              <div className="absolute inset-0 bg-primary/70" />
              {/* Pontilhado decorativo âmbar */}
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
              {/* Pontilhado âmbar decorativo */}
              <div
                className="absolute top-6 right-6 w-24 h-24 opacity-30 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(#FAB82A 2px, transparent 2px)",
                  backgroundSize: "14px 14px",
                }}
              />
              {/* Peixes decorativos SVG — silhuetas pretas */}
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
      <WaveDivider fill="#ECE7E8" />
      <section className="bg-[#ECE7E8] py-20">
        <div className="container-site space-y-10">
          <SectionHeader
            title="Avaliações de"
            highlight="Clientes"
            center
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <TestimonialCard key={t.nome} testimonial={t} />
            ))}
          </div>
        </div>
      </section>
      <WaveDivider fill="#ffffff" />

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
      <section className="bg-primary py-16">
        <div className="container-site flex flex-col items-center text-center space-y-5">
          <h3 className="text-white text-2xl sm:text-3xl font-semibold max-w-xl">
            Criação especializada de guppies selecionados
          </h3>
          <p className="text-white/80 font-light text-base max-w-md">
            Com foco em saúde, padrão e genética. Aqui, cada peixe conta uma história.
          </p>
          <div className="flex items-center gap-3 text-white text-xl font-semibold">
            <IconWhatsApp size={28} />
            <span>27 99759-4173</span>
          </div>
          <a
            href="https://wa.me/27997594173"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-accent text-[#302f2f] font-semibold px-8 py-3.5 rounded-pill hover:brightness-95 transition-all text-base"
          >
            Entrar em Contato
          </a>
        </div>
      </section>
    </>
  );
}
