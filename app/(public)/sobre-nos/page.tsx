import Image from "next/image";
import Link from "next/link";
import PageBanner from "@/components/site/PageBanner";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import CtaWhatsapp from "@/components/site/CtaWhatsapp";

export default function SobreNosPage() {
  return (
    <>
      <PageBanner
        title="Sobre Nós"
        subtitle={
          <>
            Onde a Linhagem de Guppys Se Torna{" "}
            <span className="text-accent font-semibold">Arte e Tradição</span>
          </>
        }
      />

      {/* ── História da Empresa ── */}
      <section className="bg-white py-20">
        <div className="container-site">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-12 items-start">
            {/* Imagem (40%) */}
            <div className="md:col-span-2 relative aspect-[4/3] rounded-2xl overflow-hidden">
              <Image
                src="/assets/home/prod-dragon-blue.png"
                alt="Marchezi Guppy Farm"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 40vw"
              />
            </div>

            {/* Texto (60%) */}
            <div className="md:col-span-3 space-y-5">
              <h2 className="text-primary text-3xl font-semibold">
                Nossa <span className="text-secondary">História</span>
              </h2>
              <div className="space-y-4 text-text font-light leading-relaxed">
                <p>
                  A Marchezi Guppy Farm nasceu em 2019 de uma paixão familiar que ultrapassa gerações.
                  Fundada por Manassés Marchezi e seu pai Vanderli Marchezi, nossa criação começou de
                  forma simples, com poucos aquários e um sonho claro: desenvolver linhagens nobres de
                  guppies com qualidade genética, saúde e padrão internacional.
                </p>
                <p>
                  A história de amor pelos peixes começou ainda na infância de Manassés, durante as
                  pescarias com o pai em brejos, rios, lagoas e praias. &ldquo;Lembro como se fosse hoje
                  do primeiro aquário que meu pai me deu, quando eu tinha por volta de 9 anos. Foi ali
                  que tudo começou. Desde então, nunca mais consegui parar.&rdquo;
                </p>
                <p>
                  Com o tempo, a paixão evoluiu para uma estufa moderna e estruturada, onde os guppies
                  são criados com excelência, sob rigoroso controle de qualidade da água, nutrição
                  balanceada e seleção genética criteriosa.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Conquistando Espaço ── */}
      <section className="bg-[#ECE7E8]/50 py-16">
        <div className="container-site max-w-3xl space-y-6">
          <p className="text-accent font-semibold text-sm uppercase tracking-widest">
            Conquistando Espaço
          </p>
          <h2 className="text-primary text-3xl font-semibold">
            Conquistas e <span className="text-secondary">Títulos</span>
          </h2>
          <div className="space-y-4 text-text font-light leading-relaxed">
            <p>
              Em janeiro de 2022, fomos destaque no jornal A Tribuna, o maior do Espírito Santo, com
              uma matéria especial que apresentou nossa história, os valores familiares e o envolvimento
              da filha de Manassés, Sarah Marchezi, na continuidade desse legado.
            </p>
            <p>
              No final de 2023, com a idade avançada dos pais, a criação foi transferida de Piúma para
              Guarapari, marcando uma nova fase com a chegada de Vinicius Pirovani à equipe.
            </p>
            <p>
              Esse ano também marcou nossa entrada no cenário mundial, com duas conquistas históricas no
              III WORLD GUPPY CONTEST VIRTUAL – 2023:
            </p>
            <ul className="space-y-3 pl-2">
              <li className="flex items-start gap-3">
                <span className="text-xl shrink-0">🥇</span>
                <span>
                  <strong className="font-medium">Guppy Full Black</strong> — campeão mundial na
                  categoria Delta Tail – ¾ Black - Moscow Black.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xl shrink-0">🥇</span>
                <span>
                  <strong className="font-medium">Blue Dragon Halfmoon</strong> — campeão mundial na
                  categoria Half Moon.
                </span>
              </li>
            </ul>
            <p>
              Em 2024, a linhagem Full Black conquistou o bicampeonato no World Guppy Contest Virtual.
            </p>
          </div>
          <Link
            href="/loja"
            className="inline-block bg-primary text-white font-semibold px-8 py-3.5 rounded-pill hover:bg-accent hover:text-[#302f2f] transition-all text-base"
          >
            Ver Loja
          </Link>
        </div>
      </section>

      <TestimonialsSection />
      <CtaWhatsapp />
    </>
  );
}
