// TODO (Fase 2): os 3 produtos abaixo com categoria: "linhagem" devem virar
// "linhagens-exclusivas" pra bater com o slug em CATEGORIES — hoje o filtro
// por essa categoria nunca acha nada.

export type CategoryMock = {
  slug: string;
  nome: string;
  descricao: string;
  imagem: string;
  href: string;
};

export type ProductMock = {
  id: string;
  slug: string;
  nome: string;
  preco: number;
  parcelas: number;
  valorParcela: number;
  precoPix: number;
  imagem: string;
  emEstoque: boolean;
  destaque: boolean;
  categoria: string;
};

export type Testimonial = {
  nome: string;
  cidade: string;
  avatar: string;
  texto: string;
};

export const CATEGORIES: CategoryMock[] = [
  {
    slug: "linhagens-exclusivas",
    nome: "Linhagens Exclusivas",
    descricao: "Navegue e filtre por todas as linhagens selecionadas e premium que trabalhamos.",
    imagem: "/assets/home/categoria-linhagens.png",
    href: "/loja?categoria=peixes-de-linhagem",
  },
  {
    slug: "sem-linhagem",
    nome: "Sem Linhagem",
    descricao: "Explore e descubra nossos guppys comuns, cheios de cores e personalidades únicas.",
    imagem: "/assets/home/categoria-sem-linhagem.png",
    href: "/loja?categoria=peixes-sem-linhagem",
  },
  {
    slug: "casais",
    nome: "Casais",
    descricao: "Encontre casais de guppys ideais para iniciar ou reforçar sua criação com harmonia e beleza.",
    imagem: "/assets/home/categoria-linhagens.png",
    href: "/loja?categoria=casais",
  },
];

export const PRODUCTS_MOCK: ProductMock[] = [
  {
    id: "1",
    slug: "casal-yellow-tiger",
    nome: "Casal Yellow Tiger",
    preco: 375.00,
    parcelas: 3,
    valorParcela: 125.00,
    precoPix: 337.50,
    imagem: "/assets/home/prod-yellow-tiger.jpg",
    emEstoque: false,
    destaque: true,
    categoria: "casais",
  },
  {
    id: "2",
    slug: "guppy-dragon-blue",
    nome: "Guppy Dragon Blue",
    preco: 380.00,
    parcelas: 3,
    valorParcela: 126.67,
    precoPix: 342.00,
    imagem: "/assets/home/prod-dragon-blue.png",
    emEstoque: true,
    destaque: true,
    categoria: "linhagem",
  },
  {
    id: "3",
    slug: "guppy-full-black",
    nome: "Guppy Full Black",
    preco: 250.00,
    parcelas: 3,
    valorParcela: 83.33,
    precoPix: 225.00,
    imagem: "/assets/home/prod-full-black.jpg",
    emEstoque: true,
    destaque: true,
    categoria: "linhagem",
  },
  {
    id: "4",
    slug: "guppy-red-dragon",
    nome: "Guppy Red Dragon",
    preco: 312.50,
    parcelas: 3,
    valorParcela: 104.17,
    precoPix: 281.25,
    imagem: "/assets/home/prod-red-dragon.jpg",
    emEstoque: true,
    destaque: true,
    categoria: "linhagem",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    nome: "Juliana T.",
    cidade: "Curitiba-PR",
    avatar: "/assets/home/avatar-juliana.png",
    texto: "Nunca vi guppys tão bonitos! Atendimento excelente e entrega super rápida. A loja tem uma variedade incrível, os peixes são realmente como nas fotos e com genética de alto nível!",
  },
  {
    nome: "Carlos M.",
    cidade: "Campinas-SP",
    avatar: "/assets/home/avatar-carlos.png",
    texto: "Comprei um casal e fiquei impressionado com a qualidade! Cores vivas, ativos e muito saudáveis. Dá pra ver que são peixes bem cuidados, vieram muito bem embalados e adaptaram super rápido ao aquário.",
  },
  {
    nome: "André S.",
    cidade: "Salvador-BA",
    avatar: "/assets/home/avatar-andre.jpg",
    texto: "Os peixes chegaram perfeitos e lindos! Dá pra ver o cuidado com cada detalhe. A equipe foi super atenciosa no atendimento e os guppys vieram cheios de energia. Estou muito satisfeito!",
  },
];
