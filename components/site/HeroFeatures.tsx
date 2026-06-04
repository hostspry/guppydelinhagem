import { Truck, Award, ShieldCheck, HeartHandshake } from "lucide-react";

const FEATURES = [
  { Icon: Truck, title: "Envio nacional", subtitle: "Para todo o Brasil" },
  { Icon: Award, title: "Linhagem pura", subtitle: "Peixes premiados" },
  { Icon: ShieldCheck, title: "Envio seguro", subtitle: "Embalagem com oxigênio" },
  { Icon: HeartHandshake, title: "Suporte direto", subtitle: "Via WhatsApp" },
] as const;

export default function HeroFeatures() {
  return (
    <div className="container-site border-t border-black/5 py-8 md:py-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
        {FEATURES.map(({ Icon, title, subtitle }) => (
          <div key={title} className="flex items-center gap-3">
            <Icon size={28} className="text-accent shrink-0" aria-hidden="true" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-primary">{title}</span>
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
