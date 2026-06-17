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
