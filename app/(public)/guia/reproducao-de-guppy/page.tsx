import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
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
  REPRODUCAO_INTRO,
  REPRODUCAO_GRAVIDA,
  REPRODUCAO_PASSOS,
  REPRODUCAO_FAQ,
} from "@/lib/guias-content";

// Cluster: "reprodução de guppy", "guppy grávida" (100–1K), "guppy prenha",
// "guppy tendo filhote", "guppy come os filhotes", "reprodução de lebiste".
// Aprofunda o tema que /peixe-guppy trata em uma seção; não o duplica.
export const metadata: Metadata = pageMeta({
  title: "Reprodução de Guppy (Lebiste): Guppy Grávida e Filhotes | Guia do Criador",
  description:
    "Como funciona a reprodução do guppy (lebiste): como saber que a fêmea está grávida, tempo de gestação, parto e por que o guppy come os filhotes. Guia de quem cria há gerações.",
  path: "/guia/reproducao-de-guppy",
});

const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all";

const WA_GERAL = whatsappLink(
  "Olá! Tenho uma dúvida sobre reprodução de guppy.",
);

export default function ReproducaoGuppyPage() {
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Peixe Guppy", url: `${SITE_URL}/peixe-guppy` },
    { name: "Reprodução de guppy" },
  ]);
  const articleLd = articleJsonLd(SITE_URL, {
    headline: "Reprodução de guppy (lebiste): grávida, gestação e filhotes",
    description:
      "Sinais de guppy grávida, tempo de gestação, parto e proteção dos filhotes, explicado por criador de linhagem.",
    path: "/guia/reproducao-de-guppy",
  });

  return (
    <>
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(REPRODUCAO_FAQ)} />

      <PageBanner
        as="h1"
        title="Reprodução de guppy (lebiste)"
        subtitle="Como saber que a fêmea está grávida, quanto dura a gestação e como salvar os filhotes."
      />

      {/* INTRO */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl">
          <p className="text-text font-light leading-relaxed text-lg">
            {REPRODUCAO_INTRO}
          </p>
        </div>
      </section>

      {/* GUPPY GRÁVIDA */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Como saber se a guppy está grávida
          </h2>
          <ul className="space-y-2">
            {REPRODUCAO_GRAVIDA.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-text font-light text-sm"
              >
                <span className="text-accent text-base mt-0.5 shrink-0" aria-hidden="true">
                  ●
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PASSOS */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Da gestação ao parto
          </h2>
          <div className="space-y-4">
            {REPRODUCAO_PASSOS.map((p) => (
              <div
                key={p.titulo}
                className="bg-[#ECE7E8]/40 rounded-2xl border border-border p-6 space-y-2"
              >
                <h3 className="text-primary font-semibold">{p.titulo}</h3>
                <p className="text-text font-light text-sm leading-relaxed">{p.texto}</p>
              </div>
            ))}
          </div>
          <p className="text-text font-light leading-relaxed">
            Depois que os filhotes nascem, o cuidado muda de fase. Veja como criar
            os alevinos no{" "}
            <Link href="/guia/filhotes-de-guppy" className="text-secondary font-medium hover:underline">
              guia de filhotes de guppy
            </Link>
            , e para o cuidado geral do peixe, o{" "}
            <Link href="/peixe-guppy" className="text-secondary font-medium hover:underline">
              guia completo do guppy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span>
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-white">
            {REPRODUCAO_FAQ.map((item) => (
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

      {/* CTA */}
      <section className="bg-white py-14">
        <div className="container-site max-w-3xl flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/linhagens" className={BTN_OUTLINE}>
            Ver guppys de linhagem
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
