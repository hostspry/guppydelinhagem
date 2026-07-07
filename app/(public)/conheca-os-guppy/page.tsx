import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ArrowRight, Trophy, Check, X } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import RespostaRapida from "@/components/site/RespostaRapida";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { VideoThumb } from "@/components/admin/VideoThumb";
import { pageMeta, SITE_URL } from "@/lib/seo";
import { faqPageJsonLd, breadcrumbJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { whatsappLink } from "@/lib/constants";
import { getLinhagensParaGuia } from "@/lib/queries/products";
import {
  FICHA,
  COMPARATIVO,
  CUIDADOS,
  ALIMENTACAO,
  COMPAT_BOAS,
  COMPAT_EVITAR,
  EQUIPAMENTO,
  RESP_O_QUE_E,
  RESP_INICIANTE,
  RESP_FILHOTES,
  FAQ,
} from "@/lib/guia-content";

export const metadata: Metadata = pageMeta({
  title: "Guia do Guppy (Lebiste): Cuidados, Reprodução e Criação | Guppy de Linhagem",
  description:
    "Como cuidar de guppy (lebiste): água, alimentação, reprodução e compatibilidade — pelo criador tricampeão mundial. Guia direto de quem cria há três gerações.",
  path: "/conheca-os-guppy",
});

// Lê o banco (grid de linhagens) — revalida de hora em hora, refletindo o
// catálogo sem redeploy.
export const revalidate = 3600;

const BTN_PRIMARIO =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill bg-secondary text-white font-semibold hover:brightness-110 transition-all";
const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 min-h-12 px-7 py-3 rounded-pill border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-all";
const BTN_AMBAR =
  "inline-flex items-center justify-center gap-2 min-h-12 px-8 py-3.5 rounded-pill bg-accent text-[#302f2f] font-semibold hover:brightness-95 transition-all";

const WA_GERAL = whatsappLink(
  "Olá! Quero saber mais sobre os guppys de linhagem disponíveis.",
);

export default async function ConhecaOsGuppyPage() {
  const linhagens = await getLinhagensParaGuia(6);

  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Início", url: `${SITE_URL}/` },
    { name: "Guia do Guppy (Lebiste)" },
  ]);

  return (
    <>
      {/* JSON-LD: FAQPage bate 1:1 com o acordeão da seção 16; Breadcrumb reusa o
          builder existente (mesma infraestrutura de SEO). */}
      <JsonLd data={faqPageJsonLd(FAQ)} />
      <JsonLd data={breadcrumbLd} />

      {/* ═══ 1. HERO ═══ */}
      <PageBanner
        as="h1"
        title="Guia do Guppy (Lebiste): cuidados, criação e reprodução"
        subtitle="Entenda o que é o guppy, como cuidar do jeito certo e por que um guppy de linhagem é diferente do peixe comum de loja."
      />
      <section className="bg-white py-8">
        <div className="container-site flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/" className={BTN_PRIMARIO}>
            Ver guppys disponíveis
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <a href={WA_GERAL} target="_blank" rel="noopener noreferrer" className={BTN_OUTLINE}>
            <WhatsAppIcon className="w-5 h-5" />
            Falar no WhatsApp
          </a>
        </div>
      </section>

      {/* ═══ 2. RESPOSTA RÁPIDA 1 ═══ */}
      <section className="bg-white pb-8">
        <div className="container-site max-w-3xl">
          <RespostaRapida titulo={RESP_O_QUE_E.titulo} texto={RESP_O_QUE_E.texto} />
        </div>
      </section>

      {/* ═══ 3. O QUE É O GUPPY (LEBISTE) ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            O que é o guppy, também conhecido como{" "}
            <span className="text-secondary">lebiste</span>?
          </h2>
          <p className="text-text font-light leading-relaxed">
            O guppy, ou lebiste, é um peixe ornamental de água doce (
            <em>Poecilia reticulata</em>), pequeno, resistente e cheio de vida. É
            vivíparo — a fêmea dá à luz filhotes já nadando — e tem uma variedade
            enorme de cores e formatos de cauda. Some tudo isso e você entende por
            que ele é o peixe mais indicado para quem está começando no aquarismo.
          </p>
          <p className="text-text font-light leading-relaxed">
            Só que nem todo guppy é igual. O guppy comum de loja tem genética
            misturada: você cruza dois peixes bonitos e os filhotes saem de
            qualquer jeito, sem padrão. O guppy de linhagem é o contrário — é
            fruto de seleção de várias gerações, feita para que cor, cauda e
            padrão se repitam ninhada após ninhada.
          </p>
        </div>
      </section>

      {/* ═══ 4. GUPPY COMUM × GUPPY DE LINHAGEM (tabela) ═══ */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-4xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Qual a diferença entre guppy comum e guppy de linhagem?
          </h2>
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
                    <th
                      scope="row"
                      className="px-4 py-3 font-medium text-primary text-left align-top"
                    >
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
            Na nossa criação, o trabalho é genética: escolher reprodutores, separar
            matrizes, descartar o que foge do padrão. É isso que diferencia um
            peixe de linhagem, e é esse trabalho que levou nossos Full Black ao
            título mundial três anos seguidos.
          </p>
        </div>
      </section>

      {/* ═══ 5. RESPOSTA RÁPIDA 2 ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl">
          <RespostaRapida titulo={RESP_INICIANTE.titulo} texto={RESP_INICIANTE.texto} />
        </div>
      </section>

      {/* ═══ 6. FICHA TÉCNICA ═══ */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Ficha técnica do <span className="text-secondary">guppy</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FICHA.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between bg-white rounded-xl px-5 py-3 border border-border"
              >
                <span className="text-sm font-medium text-primary">{item.label}</span>
                <span className="text-sm font-light text-text text-right">{item.valor}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 7. COMO CUIDAR ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Como cuidar de guppys corretamente
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppy é resistente, mas dá o seu melhor com cuidados simples e
            constantes. O segredo é água estável: peixe estressado por variação de
            água é peixe que adoece. Siga esta base:
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

      {/* ═══ 8. ALIMENTAÇÃO ═══ */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Alimentação ideal para guppys
          </h2>
          <p className="text-text font-light leading-relaxed">
            Uma dieta variada deixa as cores mais fortes e o peixe mais resistente.
            Ofereça pouco de cada vez, várias vezes ao dia:
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

      {/* ═══ 9. REPRODUÇÃO ═══ */}
      <section className="bg-white py-12">
        <div className="container-site max-w-3xl space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Como funciona a reprodução dos guppys?
          </h2>
          <p className="text-text font-light leading-relaxed">
            O guppy é vivíparo: a fêmea não põe ovos, os filhotes nascem já
            nadando. A gestação leva de 21 a 30 dias, e a fêmea consegue armazenar
            esperma — de um único cruzamento ela pode ter várias ninhadas seguidas.
          </p>
          <p className="text-text font-light leading-relaxed">
            Para saber que a fêmea está grávida, observe a barriga volumosa e a
            mancha gravídica, aquela área escura perto da nadadeira anal que fica
            mais forte conforme o parto se aproxima. Quando os filhotes nascem,
            separe-os dos adultos ou dê muito esconderijo com plantas, porque
            guppy adulto come alevino. Nas primeiras semanas, alimentação fina e
            frequente.
          </p>
          <p className="text-text font-light leading-relaxed">
            Reproduzir guppy é fácil. Criar linhagem é outra coisa: escolher
            reprodutores, separar matrizes, controlar cada cruzamento e descartar o
            que sai do padrão. É esse trabalho, geração após geração, que mantém
            uma linhagem campeã.
          </p>
        </div>
      </section>

      {/* ═══ 10. RESPOSTA RÁPIDA 3 ═══ */}
      <section className="bg-white pb-12">
        <div className="container-site max-w-3xl">
          <RespostaRapida titulo={RESP_FILHOTES.titulo} texto={RESP_FILHOTES.texto} />
        </div>
      </section>

      {/* ═══ 11. COMPATIBILIDADE ═══ */}
      <section className="bg-[#ECE7E8]/50 py-12">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Com quais peixes o guppy convive bem?
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppy é dócil e sociável, vive melhor em grupo e se dá bem em aquário
            comunitário planejado. Raramente é agressivo — o cuidado é com quem
            pode maltratar ele.
          </p>
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
        </div>
      </section>

      {/* ═══ 12. EQUIPAMENTO ═══ */}
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

      {/* ═══ 13. AUTORIDADE ═══ */}
      <section className="bg-primary text-white py-14">
        <div className="container-site max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 text-accent font-semibold text-sm uppercase tracking-widest">
              <Trophy size={16} aria-hidden="true" />
              Marchezi Guppy Farm
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold leading-snug">
              Criado por quem vive de guppy — e compete no mais alto nível
            </h2>
            <p className="text-white/85 font-light leading-relaxed">
              Somos três gerações de família no aquarismo, em Guarapari, no
              Espírito Santo. Nossa estufa foi projetada para até 30 mil litros de
              água, e o dia a dia é seleção de reprodutores, controle de água e
              alimentação caprichada desde o nascimento.
            </p>
            <p className="text-white/85 font-light leading-relaxed">
              Esse trabalho rendeu títulos: tricampeão mundial Full Black (2023,
              2024 e 2025), campeão Glass Tail (2024) e bicampeão Half Moon (2023 e
              2025), no World Guppy Contest. Quando você compra um guppy nosso, leva
              um peixe da mesma genética que disputa — e vence — campeonato mundial.
            </p>
            <Link
              href="/sobre-nos"
              className="inline-flex items-center gap-1.5 min-h-11 text-sm font-semibold text-accent hover:underline"
            >
              Conheça a nossa história
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="relative w-full aspect-[4/3] rounded-[22px] overflow-hidden shadow-lg">
            <Image
              src="/images/sobrenos/marchezi-lucas03.webp"
              alt="Manassés e Lucas cuidando dos guppys na estufa da Marchezi Guppy Farm, em Guarapari"
              fill
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ═══ 14. PRINCIPAIS LINHAGENS (grid dinâmico, produtos reais) ═══ */}
      {linhagens.length > 0 && (
        <section className="bg-[#ECE7E8]/50 py-14">
          <div className="container-site space-y-6">
            <div className="max-w-3xl space-y-2">
              <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
                Principais linhagens de guppy
              </h2>
              <p className="text-text font-light leading-relaxed">
                Cada linhagem tem seu padrão de cor, cauda e corpo. Estas são
                algumas das que criamos e enviamos vivas para todo o Brasil.
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {linhagens.map((l) => (
                <Link
                  key={l.slug}
                  href={`/loja/${l.slug}`}
                  className="group flex flex-col bg-white rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                    {l.thumb ? (
                      <VideoThumb
                        src={l.thumb}
                        alt={`Guppy ${l.nome}`}
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 300px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        sem imagem
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex flex-col gap-1.5 flex-1">
                    <p className="font-semibold text-primary text-sm leading-tight line-clamp-2 group-hover:text-accent transition-colors">
                      {l.nome}
                    </p>
                    {l.descricaoCurta && (
                      <p className="text-xs text-muted-foreground font-light leading-snug line-clamp-3">
                        {l.descricaoCurta}
                      </p>
                    )}
                    <span className="mt-auto pt-1 inline-flex items-center gap-1 text-sm font-semibold text-secondary group-hover:underline">
                      Ver disponibilidade →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ 15. CTA FINAL ═══ */}
      <section className="bg-secondary py-16">
        <div className="container-site flex flex-col items-center text-center space-y-5">
          <h2 className="text-white text-2xl sm:text-3xl font-semibold max-w-lg">
            Quer começar com guppys de linhagem?
          </h2>
          <p className="text-white/85 font-light text-base max-w-xl">
            Fala com a gente no WhatsApp e veja quais casais, trios e machos estão
            disponíveis. A gente te ajuda a escolher a opção certa para o seu
            aquário ou projeto de criação.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link href="/" className={BTN_AMBAR}>
              Ver guppys disponíveis
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <a
              href={WA_GERAL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-12 px-8 py-3.5 rounded-pill border-2 border-white text-white font-semibold hover:bg-white/10 transition-all"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Chamar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ═══ 16. FAQ ═══ */}
      <section className="bg-white py-14">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Perguntas <span className="text-secondary">frequentes</span> sobre guppy
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {FAQ.map((item) => (
              <details key={item.pergunta} className="group px-6 py-4">
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-primary text-sm md:text-base list-none">
                  {item.pergunta}
                  <ChevronDown
                    size={18}
                    className="shrink-0 ml-3 text-muted-foreground group-open:rotate-180 transition-transform duration-200"
                    aria-hidden="true"
                  />
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
