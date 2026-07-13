import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Trophy, ChevronDown, Check, X } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import { TricampeaoBadge } from "@/components/site/TricampeaoBadge";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import {
  faqPageJsonLd,
  breadcrumbJsonLd,
  articleJsonLd,
} from "@/lib/seo/jsonld";
import { whatsappLink } from "@/lib/constants";
import {
  FICHA,
  COMPARATIVO,
  CUIDADOS,
  ALIMENTACAO,
  COMPAT_BOAS,
  COMPAT_EVITAR,
} from "@/lib/guia-content";
import {
  GALERIA_LINHAGENS,
  FAQ_PEIXE_GUPPY,
  IMG_MACHO_FEMEA,
  IMG_FEMEA,
  IMG_HERO,
} from "@/lib/peixe-guppy-content";

// ANEXO-A. Keyword-cabeça: "peixe guppy" (10K–100K, competição Baixa), intenção
// de DESCOBERTA. Página-pilar (guia do criador, não vitrine); guppy e lebiste na
// MESMA URL. Tudo aponta para cá ou sai daqui.
export const metadata: Metadata = pageMeta({
  title: "Peixe Guppy: guia completo do criador | Marchezi Guppy Farm",
  description:
    "Peixe guppy (lebiste) por um criador tricampeão mundial (World Guppy Contest, linha Full Black): tipos, cuidados, preço e como comprar. Envio para todo o Brasil.",
  path: "/peixe-guppy",
  // OG image = foto comprovadamente própria (fêmea Ivory), não uma das suspeitas
  // de banco de imagem — é a imagem que aparece ao compartilhar.
  image: { url: IMG_FEMEA.src, width: IMG_FEMEA.width, height: IMG_FEMEA.height, alt: IMG_FEMEA.alt },
});

const BTN_PRIMARIO =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all";
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all";
const BTN_AMBAR =
  "inline-flex items-center justify-center gap-2 min-h-12 px-8 py-3.5 rounded-pill bg-accent text-[#302f2f] font-semibold hover:brightness-95 transition-all";

const WA_GERAL = whatsappLink(
  "Olá! Vim pelo guia do peixe guppy e quero ver os guppys disponíveis.",
);

export default function PeixeGuppyPage() {
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Peixe Guppy" },
  ]);
  const articleLd = articleJsonLd(SITE_URL, {
    headline: "Peixe Guppy (Lebiste): o guia completo de quem cria",
    description:
      "Guia do peixe guppy (lebiste) por um criador real: o que é, preço, macho e fêmea, tipos e linhagens, cuidados, reprodução, alimentação e onde comprar.",
    path: "/peixe-guppy",
    image: `${SITE_URL}${IMG_FEMEA.src}`,
  });

  return (
    <>
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(FAQ_PEIXE_GUPPY)} />

      <PageBanner
        as="h1"
        title="Peixe Guppy (Lebiste): o guia completo de quem cria"
        subtitle="O que é, quanto custa, como diferenciar macho e fêmea, tipos, cuidados e reprodução. Escrito por quem cria guppy de verdade, em Guarapari/ES."
      />

      {/* Faixa de autoridade (E-E-A-T) logo abaixo do H1 — o maior ativo do site. */}
      <section className="bg-primary text-white py-3">
        <div className="container-site flex flex-col sm:flex-row items-center justify-center gap-2 text-center">
          <TricampeaoBadge />
          <span className="text-sm font-light text-white/90">
            Criador tricampeão mundial na linha Full Black (2023, 2024 e 2025).
          </span>
        </div>
      </section>

      {/* ═══ 1. O QUE É O PEIXE GUPPY (LEBISTE) ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            O que é o peixe guppy, também chamado de{" "}
            <span className="text-secondary">lebiste</span>
          </h2>
          <div className="relative w-full overflow-hidden rounded-2xl border border-border">
            <Image
              src={IMG_HERO.src}
              width={IMG_HERO.width}
              height={IMG_HERO.height}
              alt={IMG_HERO.alt}
              priority
              className="w-full h-auto"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
          <p className="text-text font-light leading-relaxed">
            O guppy, conhecido no Brasil como lebiste, é um peixe ornamental de
            água doce (<em>Poecilia reticulata</em>). É pequeno, resistente,
            colorido e vivíparo (a fêmea dá à luz filhotes já nadando). Por juntar
            beleza, resistência e reprodução fácil, é o peixe ornamental mais
            popular do país e a porta de entrada clássica do aquarismo.
          </p>
          <p className="text-text font-light leading-relaxed">
            Guppy e lebiste são exatamente o mesmo peixe, só muda o nome:
            lebiste é o popular em muitas regiões do Brasil, e guppy é o nome
            internacional. Aqui na Marchezi Guppy Farm eu crio guppy de linhagem
            em Guarapari, no Espírito Santo, numa estrutura com mais de 18 mil
            litros de água e mais de 26 linhagens ativas. Não é revenda: é peixe
            nascido e selecionado na nossa criação, a mesma que rendeu o
            tricampeonato mundial na linha Full Black.
          </p>
        </div>
      </section>

      {/* ═══ 2. QUANTO CUSTA UM PEIXE GUPPY ═══ */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-4xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Quanto custa um peixe guppy
          </h2>
          <p className="text-text font-light leading-relaxed">
            Depende de que guppy você procura. O guppy comum de pet shop, de
            genética misturada, custa poucos reais. O guppy de linhagem
            selecionada custa mais, e a diferença de preço tem motivo: você paga
            anos de seleção genética, um padrão de cor e cauda que se repete, e
            filhotes previsíveis. Não é o mesmo produto.
          </p>
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-primary text-white text-left">
                  <th className="px-4 py-3 font-semibold">Característica</th>
                  <th className="px-4 py-3 font-semibold">Guppy comum</th>
                  <th className="px-4 py-3 font-semibold">Guppy de linhagem</th>
                </tr>
              </thead>
              <tbody>
                {COMPARATIVO.map((row, i) => (
                  <tr key={row.c} className={i % 2 ? "bg-[#ECE7E8]/40" : "bg-white"}>
                    <th scope="row" className="px-4 py-3 font-medium text-primary text-left align-top">
                      {row.c}
                    </th>
                    <td className="px-4 py-3 text-text font-light align-top">{row.comum}</td>
                    <td className="px-4 py-3 text-text font-light align-top">{row.linhagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-text font-light leading-relaxed">
            O preço de cada peixe disponível fica na loja, sempre com o valor real
            e desconto no Pix. Nada de preço fixo prometido aqui, porque a
            disponibilidade muda conforme a criação.
          </p>
          <Link href="/#loja" className={BTN_PRIMARIO + " w-fit"}>
            Ver preços dos guppys disponíveis
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ═══ 3. MACHO E FÊMEA ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-4xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Macho e fêmea: como diferenciar
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border">
              <Image
                src={IMG_MACHO_FEMEA.src}
                width={IMG_MACHO_FEMEA.width}
                height={IMG_MACHO_FEMEA.height}
                alt={IMG_MACHO_FEMEA.alt}
                className="w-full h-auto"
                sizes="(max-width: 768px) 100vw, 384px"
              />
            </div>
            <div className="space-y-4">
              <p className="text-text font-light leading-relaxed">
                O jeito mais confiável é olhar a nadadeira anal. No macho ela é
                fina e pontuda, o gonopódio, usado na reprodução. Na fêmea é larga,
                em formato de leque. Some a isso que o macho é menor, esguio e bem
                colorido, com cauda grande, enquanto a fêmea é maior, de corpo
                arredondado e cores mais discretas.
              </p>
              <p className="text-text font-light leading-relaxed">
                A fêmea também mostra a mancha gravídica, uma área escura perto da
                nadadeira anal, quando está gerando filhotes.
              </p>
              <Link
                href="/guia/macho-e-femea"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline"
              >
                Ver o guia completo de macho e fêmea
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <figure className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-border">
            <Image
              src={IMG_FEMEA.src}
              width={IMG_FEMEA.width}
              height={IMG_FEMEA.height}
              alt={IMG_FEMEA.alt}
              className="w-full h-auto"
              sizes="(max-width: 768px) 100vw, 448px"
            />
            <figcaption className="text-xs text-muted-foreground px-4 py-2 bg-[#ECE7E8]/40">
              Fêmea de guppy da linha Ivory: corpo robusto e arredondado, cauda com
              renda preta.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ═══ 4. TIPOS E LINHAGENS ═══ */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site space-y-6">
          <div className="max-w-3xl space-y-2">
            <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
              Tipos e linhagens de guppy
            </h2>
            <p className="text-text font-light leading-relaxed">
              Cada linhagem tem seu padrão de cor, cauda e corpo. Estas são
              algumas das que eu crio e envio vivas para todo o Brasil. Toque para
              ver a disponibilidade de cada uma.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {GALERIA_LINHAGENS.map((l) => (
              <Link
                key={l.busca}
                href={`/?busca=${encodeURIComponent(l.busca)}#loja`}
                className="group flex flex-col bg-white rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  {l.nome === "Full Black" && (
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <TricampeaoBadge size="sm" short />
                    </div>
                  )}
                  <Image
                    src={l.img}
                    alt={l.alt}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 220px"
                  />
                </div>
                <div className="px-3 py-2.5">
                  <p className="font-semibold text-primary text-sm leading-tight group-hover:text-accent transition-colors">
                    {l.nome}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link href="/linhagens" className={BTN_OUTLINE}>
              Ver todas as linhagens
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              href="/linhagens/endler"
              className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-secondary text-secondary font-semibold hover:bg-secondary hover:text-white transition-all"
            >
              Conhecer o guppy Endler
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ 5. COMO CUIDAR (resumo + link ao guia profundo) ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Como cuidar de um peixe guppy
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppy é resistente, mas dá o seu melhor com água estável e cuidados
            simples e constantes. O resumo do que funciona no dia a dia:
          </p>
          <ul className="space-y-2">
            {CUIDADOS.slice(0, 6).map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent text-base mt-0.5 shrink-0" aria-hidden="true">●</span>
                {item}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {FICHA.filter((f) =>
              ["Temperatura ideal", "pH ideal", "Tamanho adulto", "Nível de cuidado"].includes(f.label),
            ).map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 bg-[#ECE7E8]/40 rounded-xl px-5 py-3 border border-border">
                <span className="text-sm font-medium text-primary">{item.label}</span>
                <span className="text-sm font-light text-text text-right shrink-0">{item.valor}</span>
              </div>
            ))}
          </div>
          <p className="text-text font-light leading-relaxed">
            Companheiros que convivem bem: {COMPAT_BOAS.join(", ")}. Melhor evitar:{" "}
            {COMPAT_EVITAR.join(", ")}.
          </p>
          <Link
            href="/guia/como-cuidar-de-guppy"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline"
          >
            Ler o guia completo de como cuidar de guppy
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ═══ 6. REPRODUÇÃO (resumo + links) ═══ */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Reprodução: guppy grávida e filhotes
          </h2>
          <p className="text-text font-light leading-relaxed">
            O guppy é vivíparo: a fêmea não põe ovos, os filhotes nascem já
            nadando. A gestação leva de 21 a 30 dias, e a fêmea armazena esperma,
            então pode ter várias ninhadas seguidas de um único cruzamento. Você
            percebe que ela está grávida pela barriga volumosa e pela mancha
            gravídica. Como guppy adulto come alevino, o certo é proteger os
            filhotes com plantas densas ou uma maternidade.
          </p>
          <p className="text-text font-light leading-relaxed">
            Reproduzir é fácil. Criar linhagem é que dá trabalho: seleção de
            reprodutores, geração após geração. Os detalhes estão nos guias:
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/guia/reproducao-de-guppy" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline">
              Reprodução de guppy
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link href="/guia/filhotes-de-guppy" className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline">
              Filhotes de guppy
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ 7. O QUE O GUPPY COME ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            O que o peixe guppy come
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppy é onívoro e aceita bem uma dieta variada. Veja o que compõe um
            bom cardápio no dia a dia:
          </p>
          <ul className="space-y-2">
            {ALIMENTACAO.map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent text-base mt-0.5 shrink-0" aria-hidden="true">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══ AUTORIDADE (E-E-A-T) ═══ */}
      <section className="bg-primary text-white py-14">
        <div className="container-site max-w-3xl space-y-4">
          <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-widest">
            <Trophy size={16} aria-hidden="true" />
            Marchezi Guppy Farm
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold leading-snug">
            Guia escrito por quem vive de guppy
          </h2>
          <p className="text-white/85 font-light leading-relaxed">
            Somos criação de família em Guarapari, no Espírito Santo, com mais de
            18 mil litros de água e mais de 26 linhagens ativas. O dia a dia é
            seleção de reprodutores, controle de água e alimentação caprichada.
            Esse trabalho rendeu o tricampeonato mundial Full Black no World Guppy
            Contest. Quando você compra um guppy nosso, leva um peixe da mesma
            genética que disputa, e vence, campeonato mundial.
          </p>
          <Link href="/sobre-nos" className="inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-accent hover:underline">
            Conheça a nossa história
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ═══ 8. ONDE COMPRAR (fechamento comercial) ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Onde comprar peixe guppy de verdade
          </h2>
          <p className="text-text font-light leading-relaxed">
            Você encontra guppy em três lugares, e não são a mesma coisa. No pet
            shop, costuma ser guppy comum, sem controle de linhagem. No
            marketplace, você raramente sabe a procedência e o risco no transporte
            é seu. Com o criador, você sabe a linhagem, vê a genética e tem quem
            responde por como o peixe é embalado e enviado.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4 space-y-2">
              <p className="text-green-700 font-semibold text-sm flex items-center gap-1.5">
                <Check size={16} aria-hidden="true" /> Comprando do criador
              </p>
              <p className="text-text font-light text-sm leading-relaxed">
                Linhagem conhecida, peixe selecionado e aclimatado, embalado à mão
                com oxigênio e enviado para todo o Brasil.
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 space-y-2">
              <p className="text-red-600 font-semibold text-sm flex items-center gap-1.5">
                <X size={16} aria-hidden="true" /> Guppy comum de origem incerta
              </p>
              <p className="text-text font-light text-sm leading-relaxed">
                Genética misturada, filhotes imprevisíveis e nenhuma garantia de
                como o peixe foi criado ou transportado.
              </p>
            </div>
          </div>
          <p className="text-text font-light leading-relaxed">
            Eu envio guppy vivo para todos os estados, embalado à mão. Veja{" "}
            <Link href="/envio" className="text-secondary font-medium hover:underline">
              como o peixe chega vivo
            </Link>
            .
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Link href="/#loja" className={BTN_AMBAR}>
              Ver guppys disponíveis
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a href={WA_GERAL} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE}>
              <WhatsAppIcon className="w-5 h-5" />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span> sobre peixe guppy
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-white">
            {FAQ_PEIXE_GUPPY.map((item) => (
              <details key={item.pergunta} className="group px-6 py-4">
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-primary text-sm md:text-base list-none">
                  {item.pergunta}
                  <ChevronDown size={18} className="shrink-0 ml-3 text-muted-foreground group-open:rotate-180 transition-transform duration-200" aria-hidden="true" />
                </summary>
                <p className="pt-3 text-text font-light text-sm leading-relaxed">
                  {item.resposta}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
