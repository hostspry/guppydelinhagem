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
  FILHOTES_INTRO,
  FILHOTES_CUIDADOS,
  FILHOTES_ALIMENTACAO,
  FILHOTES_FAQ,
} from "@/lib/guias-content";

// Cluster: "filhote de guppy", "alevino de guppy", "como cuidar de alevinos de
// guppy", "ração para alevinos de guppy". Cuidado pós-nascimento, distinto do
// pilar e complementar ao guia de reprodução.
export const metadata: Metadata = pageMeta({
  title: "Filhote de Guppy: Como Cuidar de Alevinos e o Que Dar de Comer | Guia",
  description:
    "Como cuidar de filhote de guppy (alevino): água, proteção contra os adultos, o que dar de comer e quando separar. Guia prático de quem cria guppy de linhagem.",
  path: "/guia/filhotes-de-guppy",
});

const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all";

const WA_GERAL = whatsappLink(
  "Olá! Tenho uma dúvida sobre filhotes de guppy.",
);

export default function FilhotesGuppyPage() {
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Guia do Guppy", url: `${SITE_URL}/conheca-os-guppy` },
    { name: "Filhotes de guppy" },
  ]);
  const articleLd = articleJsonLd(SITE_URL, {
    headline: "Filhote de guppy: como cuidar de alevinos",
    description:
      "Cuidados com filhote de guppy: água estável, proteção, alimentação para alevino e quando separar por sexo.",
    path: "/guia/filhotes-de-guppy",
  });

  return (
    <>
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(FILHOTES_FAQ)} />

      <PageBanner
        as="h1"
        title="Filhotes de guppy"
        subtitle="Como criar o alevino desde o nascimento: água, proteção, comida e quando separar."
      />

      {/* INTRO */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-4">
          <p className="text-text font-light leading-relaxed text-lg">
            {FILHOTES_INTRO}
          </p>
          <p className="text-text font-light leading-relaxed">
            Se você ainda está na fase da fêmea grávida, comece pelo{" "}
            <Link href="/guia/reproducao-de-guppy" className="text-secondary font-medium hover:underline">
              guia de reprodução de guppy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* CUIDADOS */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Cuidados com o alevino
          </h2>
          <ul className="space-y-2">
            {FILHOTES_CUIDADOS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent text-base mt-0.5 shrink-0" aria-hidden="true">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ALIMENTAÇÃO */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            O que dar de comer para o filhote de guppy
          </h2>
          <ul className="space-y-2">
            {FILHOTES_ALIMENTACAO.map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent text-base mt-0.5 shrink-0" aria-hidden="true">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span>
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border bg-white">
            {FILHOTES_FAQ.map((item) => (
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
