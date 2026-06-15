import Image from "next/image";
import type { Testimonial } from "@/lib/home-content";

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6 space-y-4 flex flex-col">
      {/* Avatar + nome — dimensões FIXAS (56px). Usa width/height em atributo
          (não `fill`): o browser honra o tamanho mesmo se o CSS não carregar,
          então a miniatura nunca estoura para tela cheia. */}
      <div className="flex items-center gap-3">
        <Image
          src={testimonial.avatar}
          alt={testimonial.nome}
          width={56}
          height={56}
          className="w-14 h-14 rounded-full object-cover shrink-0 bg-muted"
        />
        <div>
          <p className="text-primary font-semibold text-sm">{testimonial.nome}</p>
          <p className="text-muted-foreground text-xs font-light">{testimonial.cidade}</p>
        </div>
      </div>

      {/* Estrelas */}
      <div className="flex items-center gap-0.5 text-accent">
        {Array.from({ length: 5 }).map((_, i) => (
          <StarIcon key={i} />
        ))}
      </div>

      {/* Texto */}
      <p className="text-text font-light text-sm leading-relaxed italic flex-1">
        &ldquo;{testimonial.texto}&rdquo;
      </p>
    </div>
  );
}
