import FreteCalculator from "@/components/FreteCalculator";

export const metadata = {
  title: "Calcule seu frete — Guppy de Linhagem",
  description:
    "Calcule o frete para receber guppies de linhagem em qualquer lugar do Brasil. Envio especializado via Jadlog e Gollog.",
};

export default function FretePage() {
  return (
    <section className="min-h-[60vh] bg-bg-alt py-12 md:py-20">
      <div className="container-site">
        <FreteCalculator />
      </div>
    </section>
  );
}
