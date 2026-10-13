import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import {
  faqPageJsonLd,
  breadcrumbJsonLd,
  articleJsonLd,
} from "@/lib/seo/jsonld";
import {
  whatsappLink,
  CRIADEIRA_MGV16_SLUG,
  CRIADEIRA_MGV16_GUIA,
} from "@/lib/constants";
import { REDES } from "@/lib/sobre-content";
import {
  CRIADEIRA_INTRO,
  CRIADEIRA_ORIGEM,
  CRIADEIRA_PECAS,
  CRIADEIRA_PASSOS,
  CRIADEIRA_USOS,
  CRIADEIRA_FAQ,
} from "@/lib/guias-content";

// Cluster: "criadeira para guppy", "como montar criadeira", "criadeira MGV16".
// Versão em página do manual impresso que acompanha a criadeira; a página do
// produto na loja linka para cá.
export const metadata: Metadata = pageMeta({
  title: "Criadeira MGV16: Como Montar e Usar | Manual da Criadeira para Guppy",
  description:
    "Manual de montagem e uso da Criadeira Marchezi MGV16: peças do kit, montagem em 4 passos sem ferramenta e como usar para reprodução, seleção e fotos de guppy.",
  path: CRIADEIRA_MGV16_GUIA,
  image: {
    url: "/images/criadeira-mgv16/og-criadeira-mgv16.jpg",
    width: 502,
    height: 500,
    alt: "Criadeira Marchezi MGV16, manual de montagem e uso",
    type: "image/jpeg",
  },
});

const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all";

const WA_GERAL = whatsappLink(
  "Olá! Tenho uma dúvida sobre a criadeira MGV16.",
);

const PRODUTO_HREF = `/loja/${CRIADEIRA_MGV16_SLUG}`;

export default function CriadeiraMgv16Page() {
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Criadeira MGV16", url: `${SITE_URL}${PRODUTO_HREF}` },
    { name: "Manual de montagem e uso" },
  ]);
  const articleLd = articleJsonLd(SITE_URL, {
    headline: "Criadeira Marchezi MGV16: manual de montagem e uso",
    description:
      "Peças do kit, montagem passo a passo e dicas de uso da criadeira MGV16 para guppy.",
    path: CRIADEIRA_MGV16_GUIA,
    image: `${SITE_URL}/images/criadeira-mgv16/capa.webp`,
  });

  return (
    <>
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(CRIADEIRA_FAQ)} />

      <PageBanner
        as="h1"
        title="Criadeira MGV16: montagem e uso"
        subtitle="O manual da Criadeira Marchezi MGV16 em página: peças, montagem em 4 passos e como eu uso na criação."
      />

      {/* INTRO */}
      <section className="bg-white py-12">
        <div className="container-site max-w-5xl grid md:grid-cols-3 gap-8 items-center">
          <div className="space-y-4 md:col-span-2">
            <p className="text-text font-light leading-relaxed text-lg">
              {CRIADEIRA_INTRO}
            </p>
            <p className="text-text font-light leading-relaxed">
              {CRIADEIRA_ORIGEM}
            </p>
            <p className="flex items-start gap-2 text-sm text-muted-foreground italic">
              <Trophy size={16} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
              Guppies premiados em competições nacionais e internacionais.
            </p>
          </div>
          <Image
            src="/images/criadeira-mgv16/capa.webp"
            alt="Capa do manual da Criadeira Marchezi MGV16, montada dentro do aquário com guppies"
            width={502}
            height={500}
            sizes="(min-width: 768px) 352px, 100vw"
            className="w-full h-auto rounded-2xl shadow-sm"
            priority
          />
        </div>
      </section>

      {/* PEÇAS */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-5xl grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
              Peças do kit
            </h2>
            <p className="text-text font-light leading-relaxed">
              Todas as peças já saem prontas para montar, com as telas presas
              nas estruturas. Não precisa de ferramenta nem cola.
            </p>
            <ul className="space-y-2">
              {CRIADEIRA_PECAS.map((p) => (
                <li key={p.nome} className="flex items-start gap-2 text-text font-light text-sm">
                  <span className="text-accent text-base mt-0.5 shrink-0" aria-hidden="true">●</span>
                  {p.nome} <span className="text-muted-foreground">({p.qtd}x)</span>
                </li>
              ))}
            </ul>
          </div>
          <Image
            src="/images/criadeira-mgv16/pecas.webp"
            alt="Peças da criadeira MGV16: lateral esquerda, lateral direita, piso, traseira e viga de esquadro"
            width={450}
            height={400}
            sizes="(min-width: 768px) 450px, 100vw"
            className="w-full h-auto rounded-2xl bg-white"
          />
        </div>
      </section>

      {/* MONTAGEM */}
      <section className="bg-white py-12">
        <div className="container-site max-w-5xl space-y-8">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Montagem passo a passo
          </h2>
          <ol className="grid sm:grid-cols-2 gap-6">
            {CRIADEIRA_PASSOS.map((passo, i) => (
              <li key={passo.titulo} className="rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-secondary text-white font-bold shrink-0">
                    {i + 1}
                  </span>
                  <h3 className="text-primary text-lg font-semibold">{passo.titulo}</h3>
                </div>
                <Image
                  src={passo.imagem}
                  alt={`Passo ${i + 1} da montagem da criadeira MGV16: ${passo.titulo.toLowerCase()}`}
                  width={210}
                  height={210}
                  sizes="210px"
                  className="mx-auto w-[210px] h-auto"
                />
                <p className="text-text font-light text-sm leading-relaxed">{passo.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* USO */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-5xl flex flex-col md:flex-row gap-8 items-start">
          <Image
            src="/images/criadeira-mgv16/montada.webp"
            alt="Criadeira MGV16 montada e pronta para uso"
            width={148}
            height={182}
            sizes="148px"
            className="mx-auto md:mx-0 w-[148px] h-auto shrink-0"
          />
          <div className="space-y-4 flex-1">
            <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
              Pronta para usar: como eu uso na criação
            </h2>
            <p className="text-text font-light leading-relaxed">
              Montada, a criadeira vai direto para o aquário, na posição que
              for melhor para o seu manejo. Ela tem 6 litros e comporta de 3 a
              6 peixes, conforme o tamanho deles.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {CRIADEIRA_USOS.map((u) => (
                <div key={u.titulo} className="rounded-xl bg-white border border-border p-4">
                  <h3 className="text-primary text-base font-semibold mb-1">{u.titulo}</h3>
                  <p className="text-text font-light text-sm leading-relaxed">{u.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span>
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-white">
            {CRIADEIRA_FAQ.map((item) => (
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
          <p className="text-text font-light text-sm">
            Quer ver o manual como ele vai impresso?{" "}
            <a
              href="/images/criadeira-mgv16/manual-completo.webp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary font-medium hover:underline"
            >
              Abrir o manual completo
            </a>
            . Dicas e bastidores da criação no{" "}
            <a href={REDES.instagram} target="_blank" rel="noopener noreferrer" className="text-secondary font-medium hover:underline">
              Instagram
            </a>{" "}
            e no{" "}
            <a href={REDES.youtube} target="_blank" rel="noopener noreferrer" className="text-secondary font-medium hover:underline">
              YouTube
            </a>
            .
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site max-w-3xl flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href={PRODUTO_HREF} className={BTN_OUTLINE}>
            Ver a criadeira na loja
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
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
      </section>
    </>
  );
}
