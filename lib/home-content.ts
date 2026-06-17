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

export const TESTIMONIALS: Testimonial[] = [
  {
    nome: "Juliana T.",
    cidade: "Curitiba-PR",
    avatar: "/assets/home/avatar-juliana.png",
    texto:
      "Nunca vi guppys tão bonitos! Atendimento excelente e entrega super rápida. A loja tem uma variedade incrível, os peixes são realmente como nas fotos e com genética de alto nível!",
  },
  {
    nome: "Carlos M.",
    cidade: "Campinas-SP",
    avatar: "/assets/home/avatar-carlos.png",
    texto:
      "Comprei um casal e fiquei impressionado com a qualidade! Cores vivas, ativos e muito saudáveis. Dá pra ver que são peixes bem cuidados, vieram muito bem embalados e adaptaram super rápido ao aquário.",
  },
  {
    nome: "André S.",
    cidade: "Salvador-BA",
    avatar: "/assets/home/avatar-andre.jpg",
    texto:
      "Os peixes chegaram perfeitos e lindos! Dá pra ver o cuidado com cada detalhe. A equipe foi super atenciosa no atendimento e os guppys vieram cheios de energia. Estou muito satisfeito!",
  },
];
