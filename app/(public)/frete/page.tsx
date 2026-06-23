import type { Metadata } from "next";
import FreteCalculator from "@/components/FreteCalculator";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Calcule seu frete | Guppy de Linhagem",
  description:
    "Calcule o frete para receber guppies de linhagem em qualquer lugar do Brasil. Enviamos via Jadlog e Gollog, com cuidado no transporte dos peixes.",
  path: "/frete",
});

export default function FretePage() {
  return (
    <section className="min-h-[60vh] bg-bg-alt py-12 md:py-20">
      <div className="container-site">
        <FreteCalculator />
      </div>
    </section>
  );
}
