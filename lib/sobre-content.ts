// Conteúdo da página /sobre-nos — fonte ÚNICA de verdade. Os textos/dados aqui
// alimentam a página E o JSON-LD (GEO). Dados confirmados pelo dono; nada de
// número/afirmação não verificável (sem UV/ozônio/exportação/depoimentos falsos).

export const timeline = [
  { ano: "2000", titulo: "O começo", texto: "Primeira bateria, com 8 aquários e peixes ainda sem linhagem." },
  { ano: "2010", titulo: "As primeiras matrizes", texto: "Criação em bacias, em casa. Guppy Cobra e HB Pastel." },
  { ano: "2014", titulo: "Fase de experiências", texto: "Guppy e camarão dividindo as piscinas. O amor era mesmo o guppy." },
  { ano: "2015", titulo: "Chegam os asiáticos", texto: "Dumbo, Dragon e Mosaico. Nasce a paixão por criar pela beleza." },
  { ano: "2019", titulo: "Nasce a Marchezi Guppy Farm", texto: "Primeira estufa, na casa do Sr. Marchezi, com cerca de 5 mil litros." },
  { ano: "2023", titulo: "Título mundial e mudança para Guarapari", texto: "Primeiro mundial e nova estufa, projetada para até 30 mil litros — ao lado do amigo Vinícius Pirovani. Ele me apresentou o aquário marinho, eu apresentei a ele o mundo dos guppys, e dessa troca nasceu a amizade." },
  { ano: "2024", titulo: "Campeões de novo", texto: "Mais um título mundial enquanto a estufa nova segue crescendo." },
  { ano: "2025", titulo: "Mais estrutura, mais títulos", texto: "Novos aquários, novas caixas, nova infraestrutura." },
  { ano: "2026", titulo: "Nova fase", texto: "Lucas da Matta entra como sócio — apaixonado por guppy, somando conhecimento e a mesma paixão que move a estufa." },
] as const;

// Dados confirmados pelo dono. Fonte única dos cards de conquista E do award do JSON-LD.
export const conquistas = [
  {
    linha: "Full Black",
    titulo: "Tricampeão Mundial",
    anos: "2023, 2024 e 2025",
    evento:
      "World Guppy Contest (WGA), representando a Brazilian Guppy Association",
    nota: "Linha desenvolvida na nossa estufa — três títulos mundiais consecutivos. Em 2023, além do título, foi vice no Best of Show: o segundo melhor peixe de todo o mundial (categoria Moscow Black / Delta ¾ Black).",
    video: "https://www.instagram.com/reel/DVgIqWJjeAV/",
    videoExtra: "https://www.instagram.com/reel/C3oE1mMLy0X/",
    destaque: true,
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
    videoExtra: "https://www.instagram.com/reel/C3n7wq1xyi7/",
    destaque: false,
  },
] as const;

export type Conquista = (typeof conquistas)[number];

// Ícones = nomes de lucide-react (resolvidos na página por um mapa, não dinâmico).
export const estrutura = [
  { titulo: "Sistemas de criação organizados", icon: "LayoutGrid" },
  { titulo: "Filtragem natural (aguapé e plantas)", icon: "Leaf" },
  { titulo: "Seleção por linhagem", icon: "Dna" },
  { titulo: "Acompanhamento diário", icon: "Eye" },
  { titulo: "Alimentação viva no manejo", icon: "Bug" },
  { titulo: "Peixes observados antes do envio", icon: "ShieldCheck" },
  { titulo: "Embalagem feita à mão pela família", icon: "Package" },
] as const;

export const beneficios = [
  { titulo: "Linhagens selecionadas", texto: "Matrizes escolhidas com critério de padrão e saúde.", icon: "Dna" },
  { titulo: "Criação pela beleza", texto: "Foco em cor, cauda, dorsal e padrão corporal.", icon: "Sparkles" },
  { titulo: "Sangue premiado", texto: "Genética de linha tricampeã mundial.", icon: "Trophy" },
  { titulo: "Saúde e adaptação", texto: "Exemplares observados e preparados antes do envio.", icon: "HeartPulse" },
  { titulo: "Envio especializado", texto: "Embalagem feita à mão para transporte seguro.", icon: "Package" },
  { titulo: "Criação nacional", texto: "Guppies produzidos no Brasil com padrão competitivo internacional.", icon: "Flag" },
] as const;

// Redes oficiais (canal ativo + Instagram). Reusadas na página e no sameAs do JSON-LD.
export const REDES = {
  youtube: "https://www.youtube.com/@marcheziguppy",
  instagram: "https://www.instagram.com/marchezi_guppy/",
} as const;

// Fatos verificáveis da organização — FONTE ÚNICA do JSON-LD (home e /sobre-nos).
// Sem endereço/CEP/horário (não confirmados); só o que é público e checável.
export const ORG = {
  nome: "Marchezi Guppy Farm",
  fundador: "Manassés Marchezi",
  fundacao: "2000",
  cidade: "Guarapari",
  uf: "ES",
  pais: "BR",
} as const;

/**
 * Objeto schema.org Organization montado dos dados confirmados (ORG + REDES).
 * `siteUrl` e `whatsappE164` vêm de quem chama (sem importar constantes externas
 * aqui, mantendo este arquivo só de dados). Campos não verificáveis ficam de fora.
 */
export function organizationJsonLd(siteUrl: string, whatsappE164: string) {
  return {
    "@type": "Organization",
    name: ORG.nome,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    founder: { "@type": "Person", name: ORG.fundador },
    foundingDate: ORG.fundacao,
    areaServed: ORG.pais,
    location: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: ORG.cidade,
        addressRegion: ORG.uf,
        addressCountry: ORG.pais,
      },
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: whatsappE164,
      contactType: "customer service",
      availableLanguage: "Portuguese",
    },
    sameAs: [REDES.youtube, REDES.instagram],
  };
}
