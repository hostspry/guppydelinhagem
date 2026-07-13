import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import RespostaRapida from "@/components/site/RespostaRapida";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import ProductCardSimple from "@/components/product/ProductCardSimple";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import {
  faqPageJsonLd,
  breadcrumbJsonLd,
  collectionPageJsonLd,
} from "@/lib/seo/jsonld";
import { whatsappLink } from "@/lib/constants";
import { listProductsLoja } from "@/lib/queries/products";
import { RESP_O_QUE_E_ENDLER, ENDLER_FAQ } from "@/lib/linhagens-content";

// Keyword-cluster alvo: "guppy endler" (1K–10K, o de maior volume de topo entre
// as linhagens), "peixe endler", "guppy endler preço", "comprar guppy endler",
// "endler lebiste". Página própria porque o Endler tem volume de topo próprio.
export const metadata: Metadata = pageMeta({
  title: "Guppy Endler: O Que É, Cuidados e Onde Comprar | Guppy de Linhagem",
  description:
    "Guppy Endler (Poecilia wingei): o que é, diferença para o guppy comum (lebiste), cuidados e reprodução. Endler de criação selecionada, com envio de peixe vivo para todo o Brasil.",
  path: "/linhagens/endler",
});

// Grid ao vivo: mostra os Endler disponíveis no catálogo (busca por "endler").
// Se não houver nenhum agora, cai no CTA de lista de espera. Reflete o estoque
// real em request-time.
export const dynamic = "force-dynamic";

const BTN_AMBAR =
  "inline-flex items-center justify-center gap-2 min-h-12 px-8 py-3.5 rounded-pill bg-accent text-[#302f2f] font-semibold hover:brightness-95 transition-all";
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-white text-white font-semibold hover:bg-white/10 transition-all";

const WA_ENDLER = whatsappLink(
  "Olá! Quero saber sobre guppy Endler disponível (ou entrar na lista de espera).",
);

export default async function EndlerPage() {
  const { items } = await listProductsLoja({ busca: "endler" });

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Guppy de Linhagem", url: `${SITE_URL}/linhagens` },
    { name: "Guppy Endler" },
  ]);
  const collectionLd = collectionPageJsonLd(SITE_URL, {
    name: "Guppy Endler (Poecilia wingei)",
    description:
      "Guppy Endler de criação selecionada da Marchezi Guppy Farm. O que é, cuidados, reprodução e disponibilidade, com envio de peixe vivo para todo o Brasil.",
    path: "/linhagens/endler",
  });

  return (
    <>
      <JsonLd data={collectionLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(ENDLER_FAQ)} />

      {/* ═══ HERO ═══ */}
      <PageBanner
        as="h1"
        title="Guppy Endler"
        subtitle="O primo pequeno e coloridíssimo do guppy. Entenda o que é o Endler, como cuidar e veja a disponibilidade."
      />

      {/* ═══ RESPOSTA RÁPIDA ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl">
          <RespostaRapida
            titulo={RESP_O_QUE_E_ENDLER.titulo}
            texto={RESP_O_QUE_E_ENDLER.texto}
          />
        </div>
      </section>

      {/* ═══ O QUE É / DIFERENÇA ═══ */}
      <section className="bg-white pb-4">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Endler, guppy e lebiste: qual a diferença?
          </h2>
          <p className="text-text font-light leading-relaxed">
            O guppy comum, também chamado de lebiste, é o{" "}
            <em>Poecilia reticulata</em>. O Endler é o{" "}
            <em>Poecilia wingei</em>, uma espécie parente. Na prática, o Endler é
            menor, com cores mais metálicas e um jeito mais próximo do peixe
            selvagem. Os dois convivem bem e chegam a cruzar entre si, mas quem
            cria linhagem mantém o Endler separado para preservar o padrão puro.
          </p>
          <p className="text-text font-light leading-relaxed">
            Se é a sua primeira vez com esse tipo de peixe, vale ler o{" "}
            <Link
              href="/peixe-guppy"
              className="text-secondary font-medium hover:underline"
            >
              guia do guppy
            </Link>
            : a base de cuidado do Endler é a mesma do guppy de linhagem.
          </p>
        </div>
      </section>

      {/* ═══ CUIDADOS RÁPIDOS ═══ */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Como cuidar de guppy Endler
          </h2>
          <ul className="space-y-2">
            {[
              "Água estável, temperatura entre 24 e 26 °C, com aquecedor na maior parte do Brasil.",
              "Aquário a partir de 20 a 40 litros já funciona bem, por ser um peixe pequeno.",
              "Alimentação variada e em pouca quantidade, várias vezes ao dia, para cor forte.",
              "Bastante planta para dar esconderijo, principalmente para os filhotes.",
              "Para manter a linhagem pura, crie o Endler separado do guppy comum.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-text font-light text-sm"
              >
                <span
                  className="text-accent text-base mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  ●
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══ GRID AO VIVO (Endler disponível) ═══ */}
      <section className="bg-white py-14">
        <div className="container-site space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Guppy Endler disponível
          </h2>
          {items.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {items.map((p) => (
                <ProductCardSimple key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-[#ECE7E8]/50 p-8 text-center space-y-4">
              <p className="text-text font-light">
                Nem sempre tenho Endler pronto para envio, porque depende da
                ninhada. Me chame no WhatsApp para entrar na lista de espera e
                saber a próxima leva. Enquanto isso, dá para ver as outras
                linhagens de guppy disponíveis.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={WA_ENDLER}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  Entrar na lista de espera
                </a>
                <Link
                  href="/linhagens"
                  className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all"
                >
                  Ver outras linhagens
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span> sobre
            guppy Endler
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-white">
            {ENDLER_FAQ.map((item) => (
              <details key={item.pergunta} className="group px-6 py-4">
                <summary className="cursor-pointer font-semibold text-primary text-sm md:text-base list-none">
                  {item.pergunta}
                </summary>
                <p className="pt-3 text-text font-light text-sm leading-relaxed">
                  {item.resposta}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="bg-secondary py-16">
        <div className="container-site flex flex-col items-center text-center space-y-5">
          <h2 className="text-white text-2xl sm:text-3xl font-semibold max-w-lg">
            Quer um guppy Endler de criação selecionada?
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link href="/linhagens" className={BTN_AMBAR}>
              Ver todas as linhagens
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a
              href={WA_ENDLER}
              target="_blank"
              rel="noopener noreferrer"
              className={BTN_OUTLINE}
            >
              <WhatsAppIcon className="w-5 h-5" />
              Chamar no WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
