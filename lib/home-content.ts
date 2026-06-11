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

export const CATEGORIES: HomeCategory[] = [
  {
    slug: "linhagens-exclusivas",
    nome: "Linhagens Exclusivas",
    descricao:
      "Navegue e filtre por todas as linhagens selecionadas e premium que trabalhamos.",
    imagem: "/assets/home/categoria-linhagens.png",
    href: "/loja?categoria=peixes-de-linhagem",
  },
  {
    slug: "sem-linhagem",
    nome: "Sem Linhagem",
    descricao:
      "Explore e descubra nossos guppys comuns, cheios de cores e personalidades únicas.",
    imagem: "/assets/home/categoria-sem-linhagem.png",
    href: "/loja?categoria=peixes-sem-linhagem",
  },
  {
    slug: "casais",
    nome: "Casais",
    descricao:
      "Encontre casais de guppys ideais para iniciar ou reforçar sua criação com harmonia e beleza.",
    imagem: "/assets/home/categoria-linhagens.png",
    href: "/loja?categoria=casais",
  },
];

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
