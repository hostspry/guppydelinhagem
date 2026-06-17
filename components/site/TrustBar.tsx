import { Trophy, Truck, Heart, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Barra de confiança — faixa PRÓPRIA (clara), separada do hero escuro pra não
// se fundir num bloco pesado. Conteúdo é prova social honesta (sem números
// inventados): linhagem, envio, criação responsável, alcance.
const FEATURES: { Icon: LucideIcon; title: string; subtitle: string }[] = [
  { Icon: Trophy, title: "Linhagens Premiadas", subtitle: "Reconhecidas em concursos" },
  { Icon: Truck, title: "Envio para todo o Brasil", subtitle: "Embalagem segura e térmica" },
  { Icon: Heart, title: "Criação Responsável", subtitle: "Saúde e bem-estar sempre" },
  { Icon: Users, title: "Clientes em todo Brasil", subtitle: "Satisfação e confiança" },
];

export default function TrustBar() {
  return (
    <section className="bg-bg-alt border-y border-primary/10">
      <div className="container-site py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {FEATURES.map(({ Icon, title, subtitle }) => (
            <div key={title} className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
                <Icon size={22} className="text-secondary" aria-hidden="true" />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-primary">{title}</span>
                <span className="text-xs text-primary/60">{subtitle}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
