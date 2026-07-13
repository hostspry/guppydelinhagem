import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, X, ChevronDown } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import RespostaRapida from "@/components/site/RespostaRapida";
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
  CUIDADOS,
  ALIMENTACAO,
  EQUIPAMENTO,
  COMPAT_BOAS,
  COMPAT_EVITAR,
  RESP_INICIANTE,
  FAQ,
} from "@/lib/guia-content";

// Cluster: "como cuidar de guppy", "peixe guppy como cuidar", "peixe lebiste como
// cuidar", "aquário ideal para guppys", "quantos guppys por litro", "peixes
// compatíveis com guppy". Satélite profundo; a pilar /peixe-guppy resume e linka.
export const metadata: Metadata = pageMeta({
  title: "Como Cuidar de Guppy (Lebiste): Aquário, Água e Alimentação | Guia",
  description:
    "Como cuidar de guppy (lebiste): tamanho de aquário, temperatura, pH, filtragem, alimentação e peixes compatíveis. Guia prático de um criador de linhagem.",
  path: "/guia/como-cuidar-de-guppy",
});

const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all";

const WA_GERAL = whatsappLink("Olá! Tenho uma dúvida sobre como cuidar de guppy.");

// FAQ desta página = subconjunto de cuidado do guia (respostas visíveis abaixo).
const CARE_FAQ = FAQ.filter((q) =>
  [
    "Qual o tamanho mínimo de aquário para guppys?",
    "Guppy precisa de aquecedor?",
    "Guppys podem viver com outros peixes?",
    "Quais os sinais de que o guppy está doente?",
  ].includes(q.pergunta),
);

export default function ComoCuidarDeGuppyPage() {
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Peixe Guppy", url: `${SITE_URL}/peixe-guppy` },
    { name: "Como cuidar de guppy" },
  ]);
  const articleLd = articleJsonLd(SITE_URL, {
    headline: "Como cuidar de guppy (lebiste): aquário, água e alimentação",
    description:
      "Guia prático de cuidado com guppy: tamanho de aquário, temperatura, pH, filtragem, alimentação, equipamento e compatibilidade.",
    path: "/guia/como-cuidar-de-guppy",
  });

  return (
    <>
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(CARE_FAQ)} />

      <PageBanner
        as="h1"
        title="Como cuidar de guppy (lebiste)"
        subtitle="Aquário, água, alimentação e companheiros: o básico bem feito para o guppy viver bem e com a cor forte."
      />

      {/* RESPOSTA RÁPIDA */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl">
          <RespostaRapida titulo={RESP_INICIANTE.titulo} texto={RESP_INICIANTE.texto} />
        </div>
      </section>

      {/* FICHA TÉCNICA */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Ficha técnica do <span className="text-secondary">guppy</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FICHA.map((item) => (
              <div key={item.label} className="flex items-center justify-between bg-white rounded-xl px-5 py-3 border border-border">
                <span className="text-sm font-medium text-primary">{item.label}</span>
                <span className="text-sm font-light text-text text-right">{item.valor}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO CUIDAR */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Cuidados no dia a dia
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppy é resistente, mas dá o seu melhor com água estável. Peixe
            estressado por variação de água é peixe que adoece. Siga esta base:
          </p>
          <ul className="space-y-2">
            {CUIDADOS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent text-base mt-0.5 shrink-0" aria-hidden="true">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ALIMENTAÇÃO */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Alimentação ideal
          </h2>
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

      {/* EQUIPAMENTO */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Equipamento necessário
          </h2>
          <ul className="space-y-2">
            {EQUIPAMENTO.map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent text-base mt-0.5 shrink-0" aria-hidden="true">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* COMPATIBILIDADE */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Com quais peixes o guppy convive bem
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4 space-y-2">
              <p className="text-green-700 font-semibold text-sm flex items-center gap-1.5">
                <Check size={16} aria-hidden="true" /> Boas companhias
              </p>
              <ul className="text-text font-light text-sm space-y-1">
                {COMPAT_BOAS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="bg-red-50 rounded-xl p-4 space-y-2">
              <p className="text-red-600 font-semibold text-sm flex items-center gap-1.5">
                <X size={16} aria-hidden="true" /> Evitar
              </p>
              <ul className="text-text font-light text-sm space-y-1">
                {COMPAT_EVITAR.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-text font-light leading-relaxed">
            Quer entender o peixe por inteiro antes de montar o aquário? Veja o{" "}
            <Link href="/peixe-guppy" className="text-secondary font-medium hover:underline">
              guia do peixe guppy
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
            {CARE_FAQ.map((item) => (
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

      {/* CTA */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site max-w-3xl flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/linhagens" className={BTN_OUTLINE}>
            Ver guppys de linhagem
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <a href={WA_GERAL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all">
            <WhatsAppIcon className="w-5 h-5" />
            Falar no WhatsApp
          </a>
        </div>
      </section>
    </>
  );
}
