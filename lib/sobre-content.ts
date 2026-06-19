// Dados confirmados pelo dono. Nomes de evento, anos e categorias validados.
// Fonte ÚNICA de verdade das conquistas: a página /sobre-nos (cards) E o JSON-LD
// (GEO) são montados daqui — editar aqui reflete nos dois lugares.
export const conquistas = [
  {
    linha: "Full Black",
    titulo: "Tricampeão Mundial",
    anos: "2023, 2024 e 2025",
    evento:
      "World Guppy Contest (WGA), representando a Brazilian Guppy Association",
    nota: "Linha desenvolvida na nossa estufa — três títulos mundiais consecutivos. Em 2023, além do título de campeão, foi vice no Best of Show: o segundo melhor peixe de todo o mundial (categoria Moscow Black / Delta ¾ Black).",
    video: "https://www.instagram.com/reel/DVgIqWJjeAV/",
    videoExtra: "https://www.instagram.com/reel/C3oE1mMLy0X/", // Best of Show 2023
    destaque: true, // carro-chefe da genética própria
  },
  {
    linha: "Glass Tail",
    titulo: "Campeão Mundial",
    anos: "2024",
    evento: "World Guppy Contest Virtual (UNAQUA)",
    nota: "Linha adquirida do criador Paulo Keijock — a quem somos gratos.",
    video: "https://www.instagram.com/reel/DG8GVXDxmfl/",
    videoExtra: null,
    destaque: false,
  },
  {
    linha: "Half Moon",
    titulo: "2x Campeão Mundial",
    anos: "2023 e 2025",
    evento: "World Guppy Contest (UNAQUA, 2023) e Campeonato Mundial WGA (2025)",
    nota: "Cauda em meia-lua, com abertura ampla e simetria.",
    video: "https://www.instagram.com/reel/DVgOw12DWEh/",
    videoExtra: "https://www.instagram.com/reel/C3n7wq1xyi7/", // Half Moon 2023
    destaque: false,
  },
] as const;

export type Conquista = (typeof conquistas)[number];

// Redes oficiais (canal ativo + Instagram). Reusadas no bloco "Acompanhe o dia a
// dia" e no sameAs do JSON-LD — uma fonte só.
export const REDES = {
  youtube: "https://www.youtube.com/@marcheziguppy",
  instagram: "https://www.instagram.com/marchezi_guppy/",
} as const;
