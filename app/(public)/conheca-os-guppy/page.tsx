import Link from "next/link";
import { ChevronDown } from "lucide-react";
import PageBanner from "@/components/site/PageBanner";
import CtaWhatsapp from "@/components/site/CtaWhatsapp";

const TECNICOS = [
  { label: "Nome científico", valor: "Poecilia reticulata" },
  { label: "Tamanho adulto", valor: "3–6 cm" },
  { label: "Temperatura ideal", valor: "22–28 °C" },
  { label: "pH ideal", valor: "6.8–7.8" },
  { label: "Dureza (GH)", valor: "8–12" },
  { label: "Expectativa de vida", valor: "2–3 anos" },
  { label: "Comportamento", valor: "Pacífico, gregário" },
  { label: "Reprodução", valor: "Vivíparo, gestação ~28 dias" },
];

const FAQ = [
  {
    pergunta: "Qual o tamanho mínimo de aquário para guppies?",
    resposta:
      "Para um grupo inicial de 6 a 8 guppies, recomendamos um aquário de pelo menos 40 litros. Aquários maiores facilitam a manutenção da qualidade da água e oferecem mais espaço para a movimentação natural dos peixes.",
  },
  {
    pergunta: "Com que frequência devo fazer trocas de água?",
    resposta:
      "O ideal é realizar trocas parciais de 20 a 30% do volume semanalmente. Em aquários com maior densidade de peixes, duas trocas por semana podem ser necessárias para manter o nível de nitrato sob controle.",
  },
  {
    pergunta: "Guppies podem viver com outros peixes?",
    resposta:
      "Sim! Guppies são pacíficos e se dão muito bem com mollys, platies, corydoras e tetras de pequeno porte. Evite bettas machos, ciclídeos agressivos e qualquer espécie grande o suficiente para predar ou estressar os guppies.",
  },
  {
    pergunta: "Quais são os sinais de que meu guppy está doente?",
    resposta:
      "Fique atento a nadadeiras fechadas, pontos brancos (Ich), perda de cor, letargia e recusa em se alimentar. Ao perceber qualquer um desses sinais, isole o peixe, analise os parâmetros da água e consulte um especialista para o tratamento adequado.",
  },
  {
    pergunta: "Como faço para reproduzir guppies?",
    resposta:
      "Guppies se reproduzem com facilidade — basta ter pelo menos um par saudável. A fêmea é vivípara e dá à luz filhotes vivos após cerca de 28 dias. Para proteger os filhotes, separe-os dos adultos assim que nascerem e alimente-os com artêmia ou ração micro.",
  },
  {
    pergunta: "Qual a diferença entre guppy de linhagem e guppy comum?",
    resposta:
      "Guppies de linhagem são resultado de seleção genética controlada ao longo de várias gerações, garantindo padrão de cor uniforme, cauda bem definida e maior resistência. Já os guppies comuns têm genética mista, com variação imprevisível de morfologia e coloração.",
  },
];

export default function ConhecaOsGuppyPage() {
  return (
    <>
      <PageBanner title="Sobre o Guppy" />

      {/* ── Introdução ── */}
      <section className="bg-white py-16">
        <div className="container-site max-w-3xl text-center space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold leading-snug">
            Tudo o que Você Precisa Saber sobre o Guppy:{" "}
            <span className="text-secondary">Cuidados, Dados Técnicos e Muito Mais</span>
          </h2>
          <p className="text-text font-light leading-relaxed">
            O guppy (<em>Poecilia reticulata</em>) é um dos peixes ornamentais mais populares do mundo —
            e por boas razões. Versátil, colorido e relativamente fácil de manter, ele encanta tanto
            iniciantes quanto aquaristas experientes. Neste guia reunimos tudo o que você precisa saber
            para criar guppies com saúde, qualidade e beleza duradoura.
          </p>
        </div>
      </section>

      {/* ── Características Técnicas ── */}
      <section className="bg-[#ECE7E8]/50 py-16">
        <div className="container-site max-w-3xl space-y-8">
          <h2 className="text-primary text-2xl font-semibold">
            Características <span className="text-secondary">Técnicas</span> do Guppy
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TECNICOS.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between bg-white rounded-xl px-5 py-3 border border-border"
              >
                <span className="text-sm font-medium text-primary">{item.label}</span>
                <span className="text-sm font-light text-text">{item.valor}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cuidados Essenciais ── */}
      <section className="bg-white py-16">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl font-semibold">
            Cuidados <span className="text-secondary">Essenciais</span>
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppies são robustos, mas prosperam com cuidados básicos e consistentes. Manter a água
            estável é a chave para peixes saudáveis e coloridos.
          </p>
          <ul className="space-y-2">
            {[
              "Troca parcial de 20% da água semanalmente",
              "Filtragem adequada com fluxo suave (evite correnteza forte)",
              "Aquecimento estável entre 24–26 °C",
              "Evitar superpopulação — máximo 1 cm de peixe por litro",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent text-base mt-0.5 shrink-0">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Alimentação ── */}
      <section className="bg-[#ECE7E8]/50 py-16">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl font-semibold">
            <span className="text-secondary">Alimentação</span>: Como Nutrir Seu Guppy
          </h2>
          <p className="text-text font-light leading-relaxed">
            Uma dieta variada garante cores vibrantes e imunidade elevada. Ofereça pequenas porções
            duas vezes ao dia — apenas o que os peixes consomem em 2 minutos.
          </p>
          <ul className="space-y-2">
            {[
              "Ração em floco de qualidade como base da dieta diária",
              "Ração viva ocasional: artêmias nauplius e dáfnias",
              "Alimentar 2× ao dia em pequenas porções",
              "Remover restos de alimento para não poluir a água",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent text-base mt-0.5 shrink-0">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Temperamento e Compatibilidade ── */}
      <section className="bg-white py-16">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl font-semibold">
            Temperamento e <span className="text-secondary">Compatibilidade</span>
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppies são peixes dóceis e sociáveis que vivem melhor em grupos. Raramente demonstram
            agressividade e se adaptam bem a aquários comunitários planejados.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4 space-y-2">
              <p className="text-green-700 font-semibold text-sm">✓ Boas companhias</p>
              <ul className="text-text font-light text-sm space-y-1">
                {["Mollys e Platies", "Corydoras", "Tetras pacíficos", "Camarões Neocaridina"].map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="bg-red-50 rounded-xl p-4 space-y-2">
              <p className="text-red-600 font-semibold text-sm">✗ Evitar</p>
              <ul className="text-text font-light text-sm space-y-1">
                {["Bettas machos", "Ciclídeos agressivos", "Peixes grandes predadores", "Espécies que mordem nadadeiras"].map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Equipamento Necessário ── */}
      <section className="bg-[#ECE7E8]/50 py-16">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl font-semibold">
            Equipamento <span className="text-secondary">Necessário</span>
          </h2>
          <ul className="space-y-2">
            {[
              "Aquário mínimo de 40 litros",
              "Filtro interno com fluxo ajustável",
              "Aquecedor 50–100 W com termostato",
              "Termômetro de aquário",
              "Iluminação LED (8–10 h/dia)",
              "Plantas naturais ou artificiais para abrigo",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent text-base mt-0.5 shrink-0">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA rosa "Garantir Meu Guppy" ── */}
      <section className="bg-secondary py-16">
        <div className="container-site flex flex-col items-center text-center space-y-5">
          <h3 className="text-white text-2xl sm:text-3xl font-semibold max-w-lg">
            Pronto para ter seu Guppy de Linhagem?
          </h3>
          <p className="text-white/80 font-light text-base max-w-md">
            Escolha entre nossas linhagens exclusivas e leve para casa um peixe saudável, bonito e
            com genética comprovada.
          </p>
          <Link
            href="/loja"
            className="inline-block bg-accent text-[#302f2f] font-semibold px-8 py-3.5 rounded-pill hover:brightness-95 transition-all text-base"
          >
            Garantir Meu Guppy
          </Link>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white py-16">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl font-semibold">
            Perguntas <span className="text-secondary">Frequentes</span>
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {FAQ.map((item) => (
              <details key={item.pergunta} className="group px-6 py-4">
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-primary text-sm md:text-base list-none">
                  {item.pergunta}
                  <ChevronDown
                    size={18}
                    className="shrink-0 ml-3 text-muted-foreground group-open:rotate-180 transition-transform duration-200"
                  />
                </summary>
                <p className="pt-3 text-text font-light text-sm leading-relaxed">{item.resposta}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CtaWhatsapp />
    </>
  );
}
