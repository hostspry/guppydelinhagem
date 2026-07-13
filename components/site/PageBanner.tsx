import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  /**
   * Tag do título. Default "h2" (não quebra usos onde a página já tem o seu h1).
   * Passe "h1" nas páginas em que o banner É o título principal (ex.: /contatos,
   * /peixe-guppy), garantindo exatamente um h1 por página.
   */
  as?: "h1" | "h2";
};

export default function PageBanner({ title, subtitle, as = "h2" }: Props) {
  const Heading = as;
  // Tamanho do título por nível, sobrescrevendo o h1/h2 global (que é grande
  // demais para o banner e estourava a altura). Faixas: h1 ~34px→51px,
  // h2 ~24px→38px, dentro do range editorial (mobile 34–42 / desktop 48–64).
  const headingSize =
    as === "h1"
      ? "text-[2rem] sm:text-4xl lg:text-5xl"
      : "text-2xl sm:text-3xl lg:text-4xl";
  return (
    // Altura FLEXÍVEL (min-height + padding) em vez de altura fixa com
    // overflow-hidden: o banner cresce com o conteúdo e o subtítulo nunca é
    // cortado. A faixa (tricampeonato) fica numa seção logo abaixo, sem
    // sobrepor. Sem alturas rígidas frágeis; funciona em todos os viewports.
    <div className="relative bg-secondary flex flex-col items-center justify-center text-center px-6 py-12 sm:py-14 min-h-[200px]">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 space-y-3 max-w-3xl mx-auto">
        <Heading
          className={`text-white font-bold leading-tight text-balance ${headingSize}`}
        >
          {title}
        </Heading>
        {subtitle && (
          <p className="text-white/90 font-light text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
