import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { faqPageJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { whatsappLink } from "@/lib/constants";
import { ATACADO_INTRO, ATACADO_MOTIVOS, ATACADO_FAQ } from "@/lib/atacado-content";

// Cluster: "criador de guppy" (10–100), "comprar guppy no atacado" (10–100),
// fornecedor de peixes ornamentais para revenda. Página de CONVERSÃO B2B (não de
// tráfego alto): objetivo é o lojista/criador falar no WhatsApp.
export const metadata: Metadata = pageMeta({
  title: "Guppy no Atacado: Fornecedor Direto do Criador | Marchezi Guppy Farm",
  description:
    "Comprar guppy de linhagem no atacado direto do criador tricampeão mundial. Fornecimento para lojas de aquarismo e revenda, com envio de peixe vivo para todo o Brasil.",
  path: "/atacado",
});

const BTN_AMBAR =
  "inline-flex items-center justify-center gap-2 min-h-12 px-8 py-3.5 rounded-pill bg-accent text-[#302f2f] font-semibold hover:brightness-95 transition-all";
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-white text-white font-semibold hover:bg-white/10 transition-all";

const WA_ATACADO = whatsappLink(
  "Olá! Tenho interesse em comprar guppy no atacado / para revenda. Pode me passar as condições?",
);

export default function AtacadoPage() {
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Atacado" },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbLd} />
      <JsonLd data={faqPageJsonLd(ATACADO_FAQ)} />

      {/* ═══ HERO ═══ */}
      <PageBanner
        as="h1"
        title="Guppy no atacado, direto do criador"
        subtitle="Para lojas de aquarismo, criadores e revenda. Guppy de linhagem selecionado na nossa estufa, com envio para todo o Brasil."
      />

      {/* ═══ INTRO + CTA ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-6">
          <p className="text-text font-light leading-relaxed text-lg">
            {ATACADO_INTRO}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={WA_ATACADO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Falar sobre atacado no WhatsApp
            </a>
            <Link
              href="/linhagens"
              className="inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all"
            >
              Ver as linhagens
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ POR QUE COMPRAR DIRETO ═══ */}
      <section className="bg-[#ECE7E8]/50 py-14">
        <div className="container-site max-w-4xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Por que se abastecer direto da nossa criação
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ATACADO_MOTIVOS.map((m) => (
              <div
                key={m.titulo}
                className="bg-white rounded-2xl border border-border p-6 space-y-2"
              >
                <h3 className="text-primary font-semibold">{m.titulo}</h3>
                <p className="text-text font-light text-sm leading-relaxed">
                  {m.texto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ AUTORIDADE ═══ */}
      <section className="bg-primary text-white py-14">
        <div className="container-site max-w-3xl space-y-4">
          <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-widest">
            <Trophy size={16} aria-hidden="true" />
            Marchezi Guppy Farm
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold leading-snug">
            Você revende peixe com história para contar
          </h2>
          <p className="text-white/85 font-light leading-relaxed">
            Nossa estufa em Guarapari foi projetada para até 30 mil litros de
            água, e o dia a dia é seleção de reprodutores, controle de água e
            alimentação caprichada. Esse trabalho rendeu o tricampeonato mundial
            Full Black no World Guppy Contest. Quando você trabalha com a nossa
            criação, leva para o seu cliente um guppy com procedência de verdade.
          </p>
          <Link
            href="/sobre-nos"
            className="inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-accent hover:underline"
          >
            Conheça a nossa história
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="bg-white py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span> sobre
            atacado
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {ATACADO_FAQ.map((item) => (
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
            Quer fornecer guppy de linhagem na sua loja?
          </h2>
          <p className="text-white/85 font-light text-base max-w-xl">
            Me conte o que você procura e o volume que pensa em levar. A partir
            daí eu vejo quais linhagens consigo atender e em quanto tempo.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <a
              href={WA_ATACADO}
              target="_blank"
              rel="noopener noreferrer"
              className={BTN_AMBAR}
            >
              <WhatsAppIcon className="w-5 h-5" />
              Falar no WhatsApp
            </a>
            <Link href="/linhagens" className={BTN_OUTLINE}>
              Ver as linhagens
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
