import type { Metadata } from "next";
import FreteCalculator from "@/components/FreteCalculator";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Cálculo de Frete de Guppy Vivo | Guppy de Linhagem",
  description:
    "Calcule o frete e receba guppys (lebistes) de linhagem em todo o Brasil. Enviamos peixe vivo via Jadlog e frete aéreo Gollog, com embalagem cuidadosa.",
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
