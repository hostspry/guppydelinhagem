// Conteúdo estático curado da home (NÃO é mock de produto). Categorias e
// depoimentos não vêm do banco: os cards de categoria usam imagem/descrição/href
// curados que não existem no schema Category, e os depoimentos são institucionais.
// Os PRODUTOS, esses sim, vêm do banco (ver lib/queries/products.ts).

export type HomeCategory = {
  slug: string;
  nome: string;
  descricao: string;
  imagem: string;
  href: string;
};

export type Testimonial = {
  nome: string;
  cidade: string;
  avatar: string;
  texto: string;
};

// CATEGORIES removido: a navegação por categoria vive nas pílulas do LojaListing
// (a seção "Principais Categorias" duplicava a taxonomia). O tipo HomeCategory
// segue por ora para o CategoryCard, que não é mais usado na home.

// Sem prova social inventada (regra do dono): depoimentos fictícios removidos.
// Preencher SÓ com avaliações reais — enquanto vazio, a seção não é renderizada.
export const TESTIMONIALS: Testimonial[] = [];

// ── Banners secundários (2-up abaixo das avaliações) ─────────────────────────
// Título em partes pra realçar palavras em rosa (secondary) sem hardcode no JSX.
export type TituloParte = { texto: string; realce?: boolean };

export type HomeBanner = {
  eyebrow?: string;
  tituloPartes: TituloParte[];
  subtitulo?: string;
  ctaLabel: string;
  ctaHref: string;
  imagem?: string;
};

export const HOME_BANNERS: { estufa: HomeBanner; aprenda: HomeBanner } = {
  // Banner 1 — estufa/cuidado (a história de campeão segue na barra de confiança,
  // no badge do hero e em /sobre-nos; aqui o foco é o processo de criação).
  estufa: {
    tituloPartes: [
      { texto: "Conheça nossa " },
      { texto: "estufa", realce: true },
      { texto: " e o " },
      { texto: "cuidado", realce: true },
      { texto: " com cada guppy" },
    ],
    subtitulo:
      "A gente cuida de cada peixe de perto, da escolha das matrizes até a hora de embalar. Veja como nossos guppys são criados.",
    ctaLabel: "Conhecer a estufa",
    ctaHref: "/sobre-nos",
    imagem: "/images/estufa.jpg",
  },
  // Banner 2 — aprenda (mantido).
  aprenda: {
    eyebrow: "Sobre os Guppy",
    tituloPartes: [{ texto: "Aprenda a criar e cuidar dos seus guppys" }],
    ctaLabel: "Conhecer",
    ctaHref: "/peixe-guppy",
  },
};
