import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import RespostaRapida from "@/components/site/RespostaRapida";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import ProductCardSimple from "@/components/product/ProductCardSimple";
import { TricampeaoBadge } from "@/components/site/TricampeaoBadge";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import {
  faqPageJsonLd,
  breadcrumbJsonLd,
  collectionPageJsonLd,
} from "@/lib/seo/jsonld";
import { whatsappLink } from "@/lib/constants";
import { listProductsLoja } from "@/lib/queries/products";
import {
  RESP_O_QUE_E_LINHAGEM,
  LINHAGENS_FAQ,
} from "@/lib/linhagens-content";
import { GALERIA_LINHAGENS } from "@/lib/peixe-guppy-content";

// Keyword-cluster alvo: "guppy de linhagem" (100–1K), "tipos de guppy" (100–1K),
// "comprar guppy de linhagem", "lebiste de linhagem". A home cobre "peixe guppy";
// esta página cobre a intenção de catálogo/tipos, sem duplicar o guia
// (/peixe-guppy), que trata cuidado e reprodução.
export const metadata: Metadata = pageMeta({
  title: "Guppy de Linhagem (Lebiste): Tipos, Cores e Preços | Marchezi Guppy Farm",
  description:
    "Guppy de linhagem (lebiste) do criador tricampeão mundial: Full Red, Full Black, Koi, Half Moon, Japan Blue, Endler e mais. Veja os tipos disponíveis e envio de peixe vivo para todo o Brasil.",
  path: "/linhagens",
});

// Lê o catálogo em request-time: a listagem reflete o estoque real e a
// disponibilidade na hora, igual à vitrine da home. Nunca lista peixe que não
// existe (a query só traz produtos ativos).
export const dynamic = "force-dynamic";

const BTN_AMBAR =
  "inline-flex items-center justify-center gap-2 min-h-12 px-8 py-3.5 rounded-pill bg-accent text-[#302f2f] font-semibold hover:brightness-95 transition-all";
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-white text-white font-semibold hover:bg-white/10 transition-all";

const WA_GERAL = whatsappLink(
  "Olá! Quero saber quais guppys de linhagem estão disponíveis.",
);

export default async function LinhagensPage() {
  const { items } = await listProductsLoja({});

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Guppy de Linhagem" },
  ]);
  const collectionLd = collectionPageJsonLd(SITE_URL, {
    name: "Guppy de Linhagem (Lebiste): tipos e preços",
    description:
      "Catálogo de guppys (lebistes) de linhagem da Marchezi Guppy Farm, criador tricampeão mundial. Envio de peixe vivo para todo o Brasil.",
    path: "/linhagens",
  });

  return (
    <>
      <JsonLd data={collectionLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(LINHAGENS_FAQ)} />

      {/* ═══ HERO ═══ */}
      <PageBanner
        as="h1"
        title="Guppy de linhagem: tipos, cores e preços"
        subtitle="Guppy, também chamado de lebiste, criado por seleção de gerações. Veja as linhagens que crio e envio vivas para todo o Brasil."
      />

      {/* ═══ INTRO / RESPOSTA RÁPIDA ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-6">
          <RespostaRapida
            titulo={RESP_O_QUE_E_LINHAGEM.titulo}
            texto={RESP_O_QUE_E_LINHAGEM.texto}
          />
          <p className="text-text font-light leading-relaxed">
            Guppy e lebiste são o mesmo peixe (<em>Poecilia reticulata</em>). A
            diferença que importa aqui é entre o guppy comum, de genética
            misturada, e o guppy de linhagem, que vem de anos de seleção para
            fixar cor, cauda e padrão. Se você quer entender o cuidado no dia a
            dia, veja o{" "}
            <Link
              href="/peixe-guppy"
              className="text-secondary font-medium hover:underline"
            >
              guia do guppy
            </Link>
            . Se já sabe o que procura, escolha por tipo abaixo.
          </p>
        </div>
      </section>

      {/* ═══ TIPOS DE GUPPY (chips → busca da loja) ═══ */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-4xl space-y-5">
          <div className="space-y-2">
            <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
              Tipos de guppy de linhagem
            </h2>
            <p className="text-text font-light leading-relaxed">
              Cada linhagem tem seu padrão de cor, cauda e corpo. Toque em uma
              para ver o que está disponível agora.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 220px"
                  />
                </div>
                <div className="px-3 py-2.5">
                  <p className="font-semibold text-primary text-sm leading-tight group-hover:text-accent transition-colors">
                    {l.nome}
                  </p>
                </div>
              </Link>
            ))}
            <Link
              href="/linhagens/endler"
              className="group flex flex-col items-center justify-center gap-2 bg-secondary text-white rounded-xl p-4 text-center hover:brightness-110 transition-all"
            >
              <Sparkles size={22} aria-hidden="true" />
              <span className="font-semibold text-sm leading-tight">Guppy Endler</span>
              <span className="text-white/85 text-xs">ver página</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ GRID AO VIVO (catálogo real) ═══ */}
      <section className="bg-white py-14">
        <div className="container-site space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Guppys de linhagem disponíveis
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
                No momento a lista está em atualização. Me chame no WhatsApp que
                eu te falo o que tem de guppy de linhagem disponível e a próxima
                ninhada.
              </p>
              <a
                href={WA_GERAL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all"
              >
                <WhatsAppIcon className="w-5 h-5" />
                Falar no WhatsApp
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span> sobre
            guppy de linhagem
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-white">
            {LINHAGENS_FAQ.map((item) => (
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
            Quer um guppy de linhagem de verdade?
          </h2>
          <p className="text-white/85 font-light text-base max-w-xl">
            Escolha na loja ou fale comigo no WhatsApp. Te ajudo a montar o casal,
            o trio ou o grupo de machos certo para o seu aquário ou criação.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link href="/#loja" className={BTN_AMBAR}>
              Ver guppys disponíveis
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a
              href={WA_GERAL}
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
