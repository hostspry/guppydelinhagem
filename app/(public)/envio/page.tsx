import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";
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
import { ENVIO_INTRO, ENVIO_PASSOS, ENVIO_FAQ } from "@/lib/envio-content";

// Cluster: "transporte de peixes vivos", "envio de peixe para todo o Brasil",
// "como o peixe chega vivo". Página de CONFIANÇA que complementa /frete (a
// calculadora): aqui explico o processo, lá se calcula o valor pelo CEP.
export const metadata: Metadata = pageMeta({
  title: "Envio de Peixe Vivo para Todo o Brasil: Como Funciona | Guppy de Linhagem",
  description:
    "Como envio guppy vivo com segurança para todo o Brasil: embalagem com oxigênio, transporte e como aclimatar o peixe ao receber. Calcule o frete pelo seu CEP.",
  path: "/envio",
});

const BTN_AMBAR =
  "inline-flex items-center justify-center gap-2 min-h-12 px-8 py-3.5 rounded-pill bg-accent text-[#302f2f] font-semibold hover:brightness-95 transition-all";
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-white text-white font-semibold hover:bg-white/10 transition-all";

const WA_ENVIO = whatsappLink(
  "Olá! Tenho uma dúvida sobre o envio do peixe.",
);

export default function EnvioPage() {
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Envio" },
  ]);
  const articleLd = articleJsonLd(SITE_URL, {
    headline: "Envio de peixe vivo para todo o Brasil: como funciona",
    description:
      "Processo de embalagem com oxigênio, transporte e aclimatação para receber guppy vivo com segurança em qualquer estado do Brasil.",
    path: "/envio",
  });

  return (
    <>
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(ENVIO_FAQ)} />

      {/* ═══ HERO ═══ */}
      <PageBanner
        as="h1"
        title="Envio de peixe vivo para todo o Brasil"
        subtitle="Como o guppy viaja seguro da nossa estufa até o seu aquário, em qualquer estado."
      />

      {/* ═══ INTRO ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-5">
          <p className="text-text font-light leading-relaxed text-lg">
            {ENVIO_INTRO}
          </p>
          <Link
            href="/frete"
            className="inline-flex items-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all w-fit"
          >
            <Calculator size={18} aria-hidden="true" />
            Calcular o frete pelo meu CEP
          </Link>
        </div>
      </section>

      {/* ═══ PASSO A PASSO ═══ */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Como o peixe chega vivo
          </h2>
          <div className="space-y-4">
            {ENVIO_PASSOS.map((p) => (
              <div
                key={p.titulo}
                className="bg-white rounded-2xl border border-border p-6 space-y-2"
              >
                <h3 className="text-primary font-semibold">{p.titulo}</h3>
                <p className="text-text font-light text-sm leading-relaxed">
                  {p.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-white py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span> sobre
            envio
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {ENVIO_FAQ.map((item) => (
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
            Pronto para receber o seu guppy?
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link href="/#loja" className={BTN_AMBAR}>
              Ver guppys disponíveis
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a
              href={WA_ENVIO}
              target="_blank"
              rel="noopener noreferrer"
              className={BTN_OUTLINE}
            >
              <WhatsAppIcon className="w-5 h-5" />
              Tirar dúvida no WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
