import { Trophy } from "lucide-react";

// Selo de autoridade (E-E-A-T). Só afirma o que é verdade: tricampeonato na linha
// Full Black no World Guppy Contest. Reutilizado na pilar /peixe-guppy e no card
// Full Black de /linhagens. Fatos em lib/sobre-content (conquistas).
export function TricampeaoBadge({
  className = "",
  size = "md",
  short = false,
}: {
  className?: string;
  size?: "sm" | "md";
  /** Versão curta ("Tricampeão Mundial") para overlays de card. */
  short?: boolean;
}) {
  const dims = size === "sm" ? "text-[11px] px-2 py-0.5 gap-1" : "text-xs px-3 py-1 gap-1.5";
  return (
    <span
      className={`inline-flex items-center rounded-pill bg-accent text-[#302f2f] font-semibold ${dims} ${className}`}
    >
      <Trophy size={size === "sm" ? 12 : 14} aria-hidden="true" />
      {short ? "Tricampeão Mundial" : "Tricampeão Mundial · World Guppy Contest"}
    </span>
  );
}
