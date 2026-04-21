import Link from "next/link";
import { ChevronDown } from "lucide-react";
import CtaWhatsapp from "@/components/site/CtaWhatsapp";

const TECNICOS = [
  { label: "Nome científico", valor: "Poecilia reticulata" },
  { label: "Tamanho adulto", valor: "3–6 cm" },
  { label: "Temperatura", valor: "22–28 °C" },
  { label: "pH", valor: "6.8–7.8" },
  { label: "Dureza (GH)", valor: "8–12" },
  { label: "Expectativa de vida", valor: "2–3 anos" },
  { label: "Comportamento", valor: "Pacífico, cardume" },
  { label: "Reprodução", valor: "Vivíparos, gestação ~28 dias" },
];

const FAQ = [
  {
    pergunta: "Qual o tamanho mínimo de aquário para guppies?",
    resposta:
      "Para um grupo pequeno de guppies, um aquário de 40 litros já é suficiente. Para casais com cria ou grupos maiores, recomendamos 80 litros ou mais, garantindo espaço para natação e renovação da água.",
  },
  {
    pergunta: "Com que frequência devo fazer trocas de água?",
    resposta:
      "Recomendamos trocas parciais de 20–30% do volume a cada 7 dias. Aquários com maior densidade de peixes podem exigir trocas duas vezes por semana para manter a qualidade ideal da água.",
  },
  {
    pergunta: "Guppies podem viver com outros peixes?",
    resposta:
      "Sim! Guppies são pacíficos e convivem bem com mollys, platies, corydoras e tetras pequenos. Evite bettas machos, ciclídeos e peixes muito maiores, pois podem agredir ou predar os guppies.",
  },
  {
    pergunta: "Quais são os sinais de que meu guppy está doente?",
    resposta:
      "Fique atento a nadadeiras fechadas, manchas brancas (Ich), letargia, perda de apetite e respiração na superfície. Ao notar qualquer sinal, isole o peixe e trate com medicamentos específicos.",
  },
  {
    pergunta: "Como faço para reproduzir guppies?",
    resposta:
      "Guppies se reproduzem facilmente: basta ter um casal saudável. A fêmea dá à luz filhotes vivos após ~28 dias de gestação. Separe os filhotes dos adultos para evitar predação e alimente-os com ração micro ou artêmia.",
  },
  {
    pergunta: "Qual a diferença entre guppy de linhagem e guppy comum?",
    resposta:
      "Guppies de linhagem passaram por seleção genética controlada por gerações, resultando em coloração uniforme, cauda definida e saúde superior. Os comuns têm genética mista e variação imprevisível de cor e formato.",
  },
];

export default function ConhecaOsGuppyPage() {
  return (
    <>
      {/* ── Banner topo ── */}
      <div className="relative h-[200px] bg-secondary overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" />
        <h2 className="relative z-10 text-white font-bold">Sobre o Guppy</h2>
      </div>

      {/* ── Seção 1: Introdução ── */}
      <section className="bg-white py-16">
        <div className="container-site max-w-3xl text-center space-y-4">
          <h2 className="text-primary text-2xl sm:text-3xl font-semibold">
            Tudo o que Você Precisa Saber sobre o Guppy:{" "}
            <span className="text-secondary">Cuidados, Dados Técnicos e Muito Mais</span>
          </h2>
          <p className="text-text font-light leading-relaxed">
            O guppy (Poecilia reticulata) é um dos peixes ornamentais mais populares do mundo — e por
            boas razões. Versátil, colorido e fácil de cuidar, ele encanta tanto iniciantes quanto
            aquaristas experientes. Neste guia, reunimos tudo o que você precisa para criar guppies
            com saúde, qualidade e beleza.
          </p>
        </div>
      </section>

      {/* ── Seção 2: Características Técnicas ── */}
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

      {/* ── Seção 3: Cuidados Essenciais ── */}
      <section className="bg-white py-16">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl font-semibold">
            Cuidados <span className="text-secondary">Essenciais</span> com Seu Guppy
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppies são resistentes, mas prosperam com cuidados básicos consistentes. Manter a água
            limpa e estável é o principal segredo para peixes saudáveis e coloridos.
          </p>
          <ul className="space-y-2">
            {[
              "Troca parcial de 20–30% da água semanalmente",
              "Filtragem eficiente com fluxo suave (guppies não gostam de correnteza forte)",
              "Aquecimento constante entre 24–26 °C",
              "Monitoramento semanal de pH, amônia e nitritos",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent mt-0.5 text-base">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Seção 4: Alimentação ── */}
      <section className="bg-[#ECE7E8]/50 py-16">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl font-semibold">
            Alimentação: Como <span className="text-secondary">Nutrir</span> Seu Guppy
          </h2>
          <p className="text-text font-light leading-relaxed">
            Uma alimentação variada garante cores vibrantes e saúde duradoura. Ofereça pequenas
            porções 2 a 3 vezes ao dia — apenas o que os peixes consomem em 2 minutos.
          </p>
          <ul className="space-y-2">
            {[
              "Ração granulada micro (principal fonte diária)",
              "Ração em flocos de alta qualidade",
              "Alimentos vivos ocasionais: artêmia, dáfnia, larva de mosquito",
              "Evite superalimentação — o excesso polui a água rapidamente",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent mt-0.5 text-base">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Seção 5: Temperamento e Compatibilidade ── */}
      <section className="bg-white py-16">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl font-semibold">
            Temperamento e <span className="text-secondary">Compatibilidade</span>
          </h2>
          <p className="text-text font-light leading-relaxed">
            Guppies são peixes dóceis e sociáveis. Vivem melhor em grupos e raramente demonstram
            agressividade. São excelentes companheiros de aquário para diversas espécies.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-green-50 rounded-xl p-4 space-y-2">
              <p className="text-green-700 font-semibold text-sm">✓ Boas companhias</p>
              <ul className="text-text font-light text-sm space-y-1">
                <li>Mollys e Platies</li>
                <li>Corydoras</li>
                <li>Tetras pequenos</li>
                <li>Camarões Neocaridina</li>
              </ul>
            </div>
            <div className="bg-red-50 rounded-xl p-4 space-y-2">
              <p className="text-red-600 font-semibold text-sm">✗ Evitar</p>
              <ul className="text-text font-light text-sm space-y-1">
                <li>Bettas machos (agressivos)</li>
                <li>Ciclídeos</li>
                <li>Peixes grandes predadores</li>
                <li>Espécies com barbatanas longas cortadas</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Seção 6: Equipamento Necessário ── */}
      <section className="bg-[#ECE7E8]/50 py-16">
        <div className="container-site max-w-3xl space-y-5">
          <h2 className="text-primary text-2xl font-semibold">
            Equipamento <span className="text-secondary">Necessário</span>
          </h2>
          <ul className="space-y-2">
            {[
              "Aquário mínimo de 40 litros",
              "Filtro interno ou externo com fluxo regulável",
              "Aquecedor com termostato (24–26 °C)",
              "Termômetro de aquário",
              "Iluminação LED (8–10h diárias)",
              "Substrato (areia fina ou cascalho pequeno)",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-text font-light text-sm">
                <span className="text-accent mt-0.5 text-base">●</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Seção 7: CTA "Garantir Meu Guppy" ── */}
      <section className="bg-secondary py-16">
        <div className="container-site flex flex-col items-center text-center space-y-5">
          <div
            className="absolute w-32 h-32 opacity-20 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#FAB82A 2px, transparent 2px)",
              backgroundSize: "12px 12px",
            }}
          />
          <h3 className="text-white text-2xl sm:text-3xl font-semibold max-w-lg relative z-10">
            Pronto para ter seu Guppy de Linhagem?
          </h3>
          <p className="text-white/80 font-light text-base max-w-md relative z-10">
            Escolha entre nossas linhagens exclusivas e leve para casa um peixe saudável, bonito e com
            genética comprovada.
          </p>
          <Link
            href="/loja"
            className="relative z-10 inline-block bg-accent text-[#302f2f] font-semibold px-8 py-3.5 rounded-pill hover:brightness-95 transition-all text-base"
          >
            Garantir Meu Guppy
          </Link>
        </div>
      </section>

      {/* ── Seção 8: FAQ ── */}
      <section className="bg-white py-16">
        <div className="container-site max-w-3xl space-y-6">
          <h2 className="text-primary text-2xl font-semibold">
            Perguntas <span className="text-secondary">Frequentes</span>
          </h2>
          <div className="divide-y divide-border">
            {FAQ.map((item) => (
              <details key={item.pergunta} className="py-4 group">
                <summary className="flex items-center justify-between cursor-pointer font-semibold text-primary text-sm md:text-base list-none">
                  {item.pergunta}
                  <ChevronDown
                    size={18}
                    className="shrink-0 ml-3 text-muted-foreground group-open:rotate-180 transition-transform"
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
