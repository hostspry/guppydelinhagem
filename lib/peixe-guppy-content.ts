// Conteúdo da página-pilar /peixe-guppy (ANEXO-A). Voz do criador, guppy e
// lebiste na mesma página. Fotos reais/genéricas liberadas pelo dono para uso no
// site; alt text descritivo com a linhagem confirmada (nome do arquivo = linha).
// Nada de preço/estoque fictício aqui — o preço real vive na loja.

import type { QaPair } from "@/lib/seo/jsonld";

// ── Galeria "Tipos e linhagens" ───────────────────────────────────────────────
// Cada card leva à busca da loja pela linhagem (mesma mecânica das pílulas). Se
// não houver peixe daquela linha no momento, o filtro só volta vazio — nunca uma
// página falsa. `alt` já descritivo (linhagem + sexo), pronto para produção.
export type LinhagemFoto = {
  nome: string;
  img: string;
  alt: string;
  busca: string;
};

export const GALERIA_LINHAGENS: LinhagemFoto[] = [
  { nome: "Full Red", img: "/images/guppy/fullred.webp", busca: "full red",
    alt: "Macho de guppy Full Red, corpo e cauda inteiramente vermelhos" },
  { nome: "Full Black", img: "/images/guppy/fullblack.webp", busca: "full black",
    alt: "Macho de guppy Full Black, preto, em aquário plantado" },
  { nome: "Blue Dragon", img: "/images/guppy/bluedragon.webp", busca: "blue dragon",
    alt: "Macho de guppy Blue Dragon, azul metálico com cauda em leque" },
  { nome: "Blue Glass", img: "/images/guppy/blueglass.webp", busca: "blue glass",
    alt: "Macho de guppy Blue Glass, corpo prateado e cauda azul salpicada" },
  { nome: "Red Dragon", img: "/images/guppy/reddragon.webp", busca: "red dragon",
    alt: "Macho de guppy Red Dragon, corpo esverdeado e cauda laranja com padrão leopardo" },
  { nome: "Red Spanish", img: "/images/guppy/redspanish.webp", busca: "red spanish",
    alt: "Macho de guppy Red Spanish, cauda grande bicolor laranja e escura" },
  { nome: "Mosaic Big Ear", img: "/images/guppy/mosaicbigear.webp", busca: "mosaic",
    alt: "Macho de guppy Mosaic Big Ear, cauda laranja em mosaico e nadadeiras peitorais grandes" },
  { nome: "Tiger", img: "/images/guppy/tiger.webp", busca: "tiger",
    alt: "Macho de guppy Tiger, cauda com anéis concêntricos pretos e amarelos" },
  { nome: "Yellow Dragon", img: "/images/guppy/yellowdragon.webp", busca: "yellow dragon",
    alt: "Macho de guppy Yellow Dragon, cauda amarela com renda preta fina" },
  { nome: "Yellow Pingu", img: "/images/guppy/yellowpingu.webp", busca: "yellow pingu",
    alt: "Macho de guppy Yellow Pingu, corpo pastel e cauda amarela" },
];

// Imagens de apoio a seções específicas (alt descritivo pronto).
export const IMG_MACHO_FEMEA = {
  src: "/images/guppy/machoxfemea.webp",
  width: 1024,
  height: 1536,
  alt: "Infográfico da Marchezi Guppy Farm comparando macho e fêmea de guppy: gonopódio e cauda maior no macho, corpo arredondado e mancha gravídica na fêmea",
} as const;

export const IMG_FEMEA = {
  src: "/images/guppy/femeaguppyivory.webp",
  width: 750,
  height: 752,
  alt: "Fêmea de guppy Ivory, corpo claro e robusto, com cauda branca de renda preta",
} as const;

export const IMG_HERO = {
  src: "/images/guppy/fullred.webp",
  width: 905,
  height: 592,
  alt: "Macho de guppy Full Red, corpo e cauda inteiramente vermelhos",
} as const;

// ── Seção "Macho e fêmea": comparação escaneável (listas semânticas) ──────────
export const MACHO_SINAIS = [
  "Corpo menor e mais esguio",
  "Cores mais intensas",
  "Cauda geralmente maior",
  "Nadadeira anal fina e pontuda",
  "Possui gonopódio",
];
export const FEMEA_SINAIS = [
  "Corpo maior e mais arredondado",
  "Cores geralmente mais discretas",
  "Nadadeira anal larga e arredondada",
  "Pode apresentar mancha gravídica",
  "Não possui gonopódio",
];

// ── FAQ (A.8) — perguntas com volume real; respostas VISÍVEIS na página ────────
export const FAQ_PEIXE_GUPPY: QaPair[] = [
  {
    pergunta: "Quanto custa um peixe guppy?",
    resposta:
      "Um guppy comum de pet shop costuma custar poucos reais. O guppy de linhagem selecionada custa mais, porque você paga anos de seleção genética, padrão de cor e cauda, e previsibilidade nos filhotes. O valor de cada peixe disponível fica na loja, com desconto no Pix.",
  },
  {
    pergunta: "Como saber se o guppy é macho ou fêmea?",
    resposta:
      "O macho é menor e mais colorido, com cauda grande e o gonopódio (nadadeira anal fina e pontuda). A fêmea é maior, de corpo mais robusto e arredondado, com a nadadeira anal em leque e cores mais discretas.",
  },
  {
    pergunta: "Como saber se a guppy está grávida?",
    resposta:
      "A barriga fica volumosa e mais quadrada, e aparece a mancha gravídica, uma área escura perto da nadadeira anal que escurece conforme o parto se aproxima. A gestação leva de 21 a 30 dias.",
  },
  {
    pergunta: "Quantos guppys por litro?",
    resposta:
      "Uma referência prática é cerca de 1 cm de peixe por litro de água. Para um grupo inicial de 6 a 8 guppys, comece com pelo menos 40 litros: mais volume deixa a água estável e os peixes mais saudáveis.",
  },
  {
    pergunta: "Quanto tempo vive um guppy?",
    resposta:
      "Em geral de 2 a 3 anos, dependendo da genética, da qualidade da água e da alimentação. Água estável e dieta variada ajudam o peixe a viver mais e com a cor forte.",
  },
];
