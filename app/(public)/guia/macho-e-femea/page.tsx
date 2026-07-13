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
  MACHO_FEMEA_INTRO,
  MACHO_FEMEA_COMPARATIVO,
  MACHO_FEMEA_FAQ,
} from "@/lib/guias-content";

// Cluster: "guppy macho e fêmea", "guppy fêmea", "guppy macho", "lebiste macho e
// fêmea". Tema de sexagem, distinto do pilar /conheca-os-guppy.
export const metadata: Metadata = pageMeta({
  title: "Guppy Macho e Fêmea: Como Diferenciar (Lebiste) | Guia do Criador",
  description:
    "Como diferenciar guppy macho de fêmea (lebiste): gonopódio, tamanho, cor e a proporção ideal no aquário. Guia direto de quem cria guppy de linhagem.",
  path: "/guia/macho-e-femea",
});

const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all";

const WA_GERAL = whatsappLink(
  "Olá! Tenho uma dúvida sobre macho e fêmea de guppy.",
);

export default function MachoFemeaPage() {
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Guia do Guppy", url: `${SITE_URL}/conheca-os-guppy` },
    { name: "Macho e fêmea" },
  ]);
  const articleLd = articleJsonLd(SITE_URL, {
    headline: "Guppy macho e fêmea (lebiste): como diferenciar",
    description:
      "Diferenças entre guppy macho e fêmea: gonopódio, tamanho, cor e proporção ideal no aquário.",
    path: "/guia/macho-e-femea",
  });

  return (
    <>
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(MACHO_FEMEA_FAQ)} />

      <PageBanner
        as="h1"
        title="Guppy macho e fêmea"
        subtitle="Como diferenciar o macho da fêmea no guppy (lebiste) e montar a proporção certa no aquário."
      />

      {/* INTRO */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl">
          <p className="text-text font-light leading-relaxed text-lg">
            {MACHO_FEMEA_INTRO}
          </p>
        </div>
      </section>

      {/* TABELA COMPARATIVA */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-4xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Macho x fêmea: as diferenças
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border bg-white">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-primary text-white text-left">
                  <th className="px-4 py-3 font-semibold">Característica</th>
                  <th className="px-4 py-3 font-semibold">Macho</th>
                  <th className="px-4 py-3 font-semibold">Fêmea</th>
                </tr>
              </thead>
              <tbody>
                {MACHO_FEMEA_COMPARATIVO.map((row, i) => (
                  <tr key={row.c} className={i % 2 ? "bg-[#ECE7E8]/40" : "bg-white"}>
                    <th
                      scope="row"
                      className="px-4 py-3 font-medium text-primary text-left align-top"
                    >
                      {row.c}
                    </th>
                    <td className="px-4 py-3 text-text font-light align-top">{row.macho}</td>
                    <td className="px-4 py-3 text-text font-light align-top">{row.femea}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-text font-light leading-relaxed">
            Se a sua fêmea está grávida, veja o que esperar no{" "}
            <Link href="/guia/reproducao-de-guppy" className="text-secondary font-medium hover:underline">
              guia de reprodução de guppy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span>
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {MACHO_FEMEA_FAQ.map((item) => (
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
      <section className="bg-[#ECE7E8]/50 py-14">
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
