import WaveDivider from "@/components/site/WaveDivider";
import SectionHeader from "@/components/home/SectionHeader";
import TestimonialCard from "@/components/home/TestimonialCard";
import { TESTIMONIALS } from "@/lib/home-content";

export default function TestimonialsSection() {
  return (
    <>
      <WaveDivider fill="#ECE7E8" />
      <section className="bg-[#ECE7E8] py-20">
        <div className="container-site space-y-10">
          <SectionHeader
            title="Avaliações de"
            highlight="Clientes"
            center
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <TestimonialCard key={t.nome} testimonial={t} />
            ))}
          </div>
        </div>
      </section>
      <WaveDivider fill="#ffffff" />
    </>
  );
}
