import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: ReactNode;
  /**
   * Tag do título. Default "h2" (não quebra usos onde a página já tem o seu h1).
   * Passe "h1" nas páginas em que o banner É o título principal (ex.: /contatos,
   * /conheca-os-guppy), garantindo exatamente um h1 por página.
   */
  as?: "h1" | "h2";
};

export default function PageBanner({ title, subtitle, as = "h2" }: Props) {
  const Heading = as;
  return (
    <div className="relative h-[220px] bg-secondary overflow-hidden flex flex-col items-center justify-center text-center px-6">
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 space-y-2">
        <Heading className="text-white font-bold">{title}</Heading>
        {subtitle && (
          <p className="text-white/90 font-light text-base max-w-xl">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
