// Conteúdo estático da página de produto. Texto fixo, reaproveitável; os ícones
// são escolhidos no componente via `icon` (chave → lucide).
//
// A loja não vende só peixe. Uma criadeira, uma ração ou um filtro na mesma
// página que fala de "garantia de chegada viva", "embalagem com oxigênio",
// "linhagem" e "nova ninhada" confunde quem está comprando: o cliente lê sobre
// envio de peixe vivo num item que vai de caixa de papelão. Por isso o conteúdo
// é resolvido por VOZ (peixe / vivo / seco / digital) a partir do tipo do
// produto, num lugar só — nada de espalhar `if (tipo === "PEIXE")` pela página.

import { whatsappLink } from "@/lib/constants";
import type { ProductType } from "@/lib/generated/prisma/enums";

export type IconKey =
  | "trophy"
  | "dna"
  | "droplets"
  | "clock"
  | "shield"
  | "truck"
  | "wind"
  | "headset"
  | "package"
  | "wrench";

/**
 * Voz do conteúdo:
 * - peixe: guppy (linhagem, ninhada, chegada viva).
 * - vivo: coral, planta, alimento vivo — vai na caixa de isopor, mas não é peixe.
 * - seco: ração, acessório — caixa de papelão, sem oxigênio e sem linhagem.
 * - digital: não despacha nada.
 */
export type VozProduto = "peixe" | "vivo" | "seco" | "digital";

const VOZ_POR_TIPO: Record<ProductType, VozProduto> = {
  PEIXE: "peixe",
  CORAL: "vivo",
  PLANTA: "vivo",
  ALIMENTO_VIVO: "vivo",
  RACAO: "seco",
  ACESSORIO: "seco",
  DIGITAL: "digital",
};

/** Tipo desconhecido cai em "peixe": é o conteúdo mais completo da loja. */
export function vozDoProduto(tipo: string | null | undefined): VozProduto {
  if (!tipo) return "peixe";
  return VOZ_POR_TIPO[tipo as ProductType] ?? "peixe";
}

export type Selo = { icon: IconKey; label: string };
export type ProvaSocial = { icon: IconKey; texto: string; destaque: boolean };
export type Diferencial = { icon: IconKey; title: string; desc: string };
export type Pergunta = { pergunta: string; resposta: string };
export type BlocoInstitucional = {
  titulo: string;
  texto: string;
  /** Foto do bloco. Null = card centralizado com ícone (sem foto que sirva). */
  imagem: string | null;
  icone?: IconKey;
  checks?: string[];
  link?: { label: string; href: string };
};

export type ConteudoProduto = {
  /** Selos de confiança no topo da compra (4, em linha). */
  selosTopo: Selo[];
  /** Prova social honesta — sem estrelas nem avaliação inventada. */
  provaSocial: ProvaSocial[];
  /** Faixa de diferenciais (logo abaixo da compra). */
  diferenciais: Diferencial[];
  /** Título da descrição longa do produto. */
  tituloDescricao: string;
  /** Fecho da descrição. Null = sem nota (não force credencial de peixe). */
  nota: string | null;
  /** Blocos institucionais (3). */
  institucionais: BlocoInstitucional[];
  faq: Pergunta[];
  /** Faixa "compra segura" do rodapé. */
  seguranca: Selo[];
  /** Selo de chegada viva ao lado da faixa. Só onde ele vale. */
  mostrarSeloChegadaViva: boolean;
  /** Título da vitrine de relacionados (com e sem co-visualização medida). */
  relacionados: { medido: string; padrao: string };
  /** Lista de espera (produto esgotado). */
  esperaTexto: string;
  esperaConfirmacao: string;
  esperaToast: string;
};

// ─────────────────────────────────────────────────────────────
// Peixe (e demais carga viva)
// ─────────────────────────────────────────────────────────────

const CONTEUDO_PEIXE: ConteudoProduto = {
  selosTopo: [
    { icon: "shield", label: "Garantia de chegada viva" },
    { icon: "truck", label: "Envio para todo o Brasil" },
    { icon: "wind", label: "Embalagem com oxigênio" },
    { icon: "headset", label: "Suporte pós-venda" },
  ],
  provaSocial: [
    { icon: "shield", texto: "+10 mil guppys vendidos na estufa", destaque: true },
    {
      icon: "trophy",
      texto: "Criador campeão no World Guppy Contest",
      destaque: false,
    },
  ],
  diferenciais: [
    {
      icon: "trophy",
      title: "Criador premiado",
      desc: "Campeão no World Guppy Contest.",
    },
    {
      icon: "dna",
      title: "Linhagens selecionadas",
      desc: "Trabalhadas com critério, geração após geração.",
    },
    {
      icon: "droplets",
      title: "Ambiente cuidado",
      desc: "Água monitorada e manejo de perto.",
    },
    {
      icon: "clock",
      title: "+10 anos de experiência",
      desc: "Todo dia cuidando dos guppys.",
    },
  ],
  tituloDescricao: "Sobre a linhagem",
  nota: "Cada peixe é escolhido à mão na Marchezi Guppy Farm, por um criador premiado no World Guppy Contest, com seleção feita com critério e manejo diário.",
  institucionais: [
    {
      titulo: "Sobre a criação",
      texto:
        "Nossa estufa é só para guppies de linhagem. A gente seleciona com critério e acompanha cada geração de perto, todo dia.",
      imagem: "/images/estufa.jpg",
      link: { label: "Conheça nossa estrutura", href: "/sobre-nos" },
    },
    {
      titulo: "Como enviamos",
      texto:
        "Cada peixe vai em embalagem preparada para chegar com segurança em todo o Brasil:",
      imagem: "/images/caixa.webp",
      checks: [
        "Sacos duplos reforçados",
        "Oxigênio puro",
        "Caixa térmica",
        "Envio rápido e seguro",
      ],
    },
    {
      titulo: "Garantia de chegada viva",
      texto:
        "Se algo acontecer no transporte, a gente resolve. Sua compra é protegida pela nossa garantia de chegada viva.",
      imagem: "/images/selo.webp",
      link: {
        label: "Saiba mais sobre nossa garantia",
        href: whatsappLink(
          "Olá! Quero saber mais sobre a garantia de chegada viva.",
        ),
      },
    },
  ],
  faq: [
    {
      pergunta: "Quanto tempo leva o envio?",
      resposta:
        "O prazo depende do seu CEP e da modalidade (Jadlog ou Gollog). Você vê a estimativa calculando o frete na própria página.",
    },
    {
      pergunta: "Os peixes chegam vivos?",
      resposta:
        "Sim. Enviamos com embalagem oxigenada e oferecemos garantia de chegada viva.",
    },
    {
      pergunta: "Qual a temperatura ideal da água?",
      resposta:
        "Guppies se adaptam bem entre 22 e 28°C. Confira a ficha técnica para parâmetros específicos da linhagem.",
    },
    {
      pergunta: "Posso escolher macho ou fêmea?",
      resposta:
        "A composição (macho, fêmea, casal, trio) está indicada na ficha técnica. Dúvidas? Fale com a gente no WhatsApp.",
    },
    {
      pergunta: "Como é feita a embalagem?",
      resposta:
        "Saquinhos com água oxigenada, dentro de caixa de isopor com proteção térmica. É o mesmo padrão que os criadores usam para transportar peixe com segurança.",
    },
    {
      pergunta: "Posso misturar com outras espécies?",
      resposta:
        "Guppies convivem bem com espécies pacíficas de porte similar. Evite peixes grandes ou agressivos. Podemos orientar no WhatsApp.",
    },
  ],
  seguranca: [
    { icon: "shield", label: "Garantia de chegada viva" },
    { icon: "package", label: "Embalagem profissional" },
    { icon: "truck", label: "Envio rápido e rastreado" },
    { icon: "headset", label: "Suporte pós-venda no WhatsApp" },
  ],
  mostrarSeloChegadaViva: true,
  relacionados: {
    medido: "Quem viu este peixe também viu",
    padrao: "Outros peixes da loja",
  },
  esperaTexto:
    "Sem estoque no momento. Deixe seu WhatsApp e avisamos quando houver nova ninhada.",
  esperaConfirmacao:
    "Tudo certo! Você está na lista de espera. Assim que sair uma nova ninhada deste peixe, a gente te avisa no WhatsApp.",
  esperaToast:
    "Pronto! Avisaremos você no WhatsApp quando este peixe estiver disponível.",
};

// Coral, planta e alimento vivo viajam como o peixe (isopor, aéreo), mas não
// têm linhagem nem ninhada. Herda o que é de transporte, troca o que é de peixe.
const CONTEUDO_VIVO: ConteudoProduto = {
  ...CONTEUDO_PEIXE,
  selosTopo: [
    { icon: "shield", label: "Garantia de chegada vivo" },
    { icon: "truck", label: "Envio para todo o Brasil" },
    { icon: "wind", label: "Embalagem com oxigênio" },
    { icon: "headset", label: "Suporte pós-venda" },
  ],
  provaSocial: [
    { icon: "shield", texto: "Loja da Marchezi Guppy Farm", destaque: true },
    {
      icon: "clock",
      texto: "Mais de 10 anos cuidando de aquário todo dia",
      destaque: false,
    },
  ],
  diferenciais: [
    {
      icon: "droplets",
      title: "Ambiente cuidado",
      desc: "Água monitorada e manejo de perto.",
    },
    {
      icon: "wind",
      title: "Embalagem com oxigênio",
      desc: "Vai na mesma caixa térmica dos peixes.",
    },
    {
      icon: "truck",
      title: "Envio para todo o Brasil",
      desc: "Sai da estufa com rastreio.",
    },
    {
      icon: "headset",
      title: "Suporte de verdade",
      desc: "Dúvida no manejo? Chame no WhatsApp.",
    },
  ],
  tituloDescricao: "Sobre o produto",
  nota: null,
  faq: [
    {
      pergunta: "Quanto tempo leva o envio?",
      resposta:
        "O prazo depende do seu CEP e da modalidade (Jadlog ou Gollog). Você vê a estimativa calculando o frete na própria página.",
    },
    {
      pergunta: "Chega vivo mesmo?",
      resposta:
        "Sim. Vai em embalagem oxigenada, na mesma caixa térmica dos peixes, com garantia de chegada viva.",
    },
    {
      pergunta: "Posso comprar junto com peixes?",
      resposta:
        "Pode. Havendo peixe no carrinho, tudo vai na mesma caixa e você paga um frete só.",
    },
    {
      pergunta: "Como faço a aclimatação?",
      resposta:
        "Abra a embalagem em ambiente com pouca luz e iguale a temperatura antes de soltar no aquário. Qualquer dúvida, a gente orienta no WhatsApp.",
    },
  ],
  relacionados: {
    medido: "Quem viu este produto também viu",
    padrao: "Outros produtos da loja",
  },
  esperaTexto:
    "Sem estoque no momento. Deixe seu WhatsApp e avisamos assim que voltar.",
  esperaConfirmacao:
    "Tudo certo! Você está na lista de espera. Assim que este produto voltar, a gente te avisa no WhatsApp.",
  esperaToast:
    "Pronto! Avisaremos você no WhatsApp quando este produto estiver disponível.",
};

// ─────────────────────────────────────────────────────────────
// Seco (ração, acessório)
// ─────────────────────────────────────────────────────────────

const CONTEUDO_SECO: ConteudoProduto = {
  selosTopo: [
    { icon: "truck", label: "Envio para todo o Brasil" },
    { icon: "package", label: "Embalado com proteção" },
    { icon: "shield", label: "Pagamento seguro" },
    { icon: "headset", label: "Suporte no WhatsApp" },
  ],
  provaSocial: [
    { icon: "shield", texto: "Loja da Marchezi Guppy Farm", destaque: true },
    {
      icon: "clock",
      texto: "Escolhido por quem cria guppy há mais de 10 anos",
      destaque: false,
    },
  ],
  diferenciais: [
    {
      icon: "wrench",
      title: "Feito para a criação",
      desc: "Item pensado para o dia a dia do aquário.",
    },
    {
      icon: "clock",
      title: "+10 anos de estufa",
      desc: "Quem indica cria guppy todo dia.",
    },
    {
      icon: "truck",
      title: "Envio para todo o Brasil",
      desc: "Sai com código de rastreio.",
    },
    {
      icon: "headset",
      title: "Suporte de verdade",
      desc: "Dúvida no uso? Chame no WhatsApp.",
    },
  ],
  tituloDescricao: "Sobre o produto",
  nota: null,
  institucionais: [
    {
      titulo: "Sobre a loja",
      texto:
        "A loja nasceu da nossa estufa de guppy de linhagem. Além dos peixes, vendemos os itens que usamos no manejo do dia a dia.",
      imagem: "/images/estufa.jpg",
      link: { label: "Conheça nossa estrutura", href: "/sobre-nos" },
    },
    {
      titulo: "Como enviamos",
      texto:
        "Seu pedido vai embalado para aguentar o transporte e segue com rastreio:",
      // A foto da caixa é de peixe vivo (sacos com oxigênio). Aqui ela diria o
      // contrário do texto, então o bloco vai com ícone.
      imagem: null,
      icone: "package",
      checks: [
        "Embalagem reforçada",
        "Conferido antes de postar",
        "Código de rastreio",
        "Envio para todo o Brasil",
      ],
    },
    {
      titulo: "Chegou com problema?",
      texto:
        "Se o item chegar danificado no transporte ou vier diferente do anunciado, fale com a gente. Resolvemos direto no WhatsApp.",
      imagem: null,
      icone: "shield",
      link: {
        label: "Falar no WhatsApp",
        href: whatsappLink("Olá! Tenho um problema com um produto que comprei."),
      },
    },
  ],
  faq: [
    {
      pergunta: "Quanto tempo leva a entrega?",
      resposta:
        "Depende do seu CEP e da transportadora. Calcule o frete aqui na página para ver o prazo estimado antes de comprar.",
    },
    {
      pergunta: "O envio tem rastreio?",
      resposta:
        "Tem. Assim que o pedido é postado, você recebe o código para acompanhar a entrega.",
    },
    {
      pergunta: "Posso comprar junto com peixes?",
      resposta:
        "Pode. Havendo peixe no carrinho, tudo vai na mesma caixa térmica e você paga um frete só. Sem peixe, o frete é o da transportadora comum.",
    },
    {
      pergunta: "E se chegar quebrado ou errado?",
      resposta:
        "Manda uma foto pra gente no WhatsApp. Item danificado no transporte ou diferente do anunciado a gente resolve com você.",
    },
    {
      pergunta: "Serve para o meu aquário?",
      resposta:
        "As medidas estão na ficha técnica. Se ficar em dúvida, chame no WhatsApp: a gente usa esses itens todo dia e ajuda a escolher.",
    },
  ],
  seguranca: [
    { icon: "shield", label: "Pagamento seguro" },
    { icon: "package", label: "Embalagem reforçada" },
    { icon: "truck", label: "Envio rastreado" },
    { icon: "headset", label: "Suporte no WhatsApp" },
  ],
  mostrarSeloChegadaViva: false,
  relacionados: {
    medido: "Quem viu este produto também viu",
    padrao: "Outros produtos da loja",
  },
  esperaTexto:
    "Sem estoque no momento. Deixe seu WhatsApp e avisamos assim que voltar.",
  esperaConfirmacao:
    "Tudo certo! Você está na lista de espera. Assim que este produto voltar, a gente te avisa no WhatsApp.",
  esperaToast:
    "Pronto! Avisaremos você no WhatsApp quando este produto estiver disponível.",
};

// Digital não despacha nada: qualquer frase de envio, embalagem ou rastreio
// seria mentira na página.
const CONTEUDO_DIGITAL: ConteudoProduto = {
  ...CONTEUDO_SECO,
  selosTopo: [
    { icon: "package", label: "Entrega digital" },
    { icon: "clock", label: "Acesso após a confirmação" },
    { icon: "shield", label: "Pagamento seguro" },
    { icon: "headset", label: "Suporte no WhatsApp" },
  ],
  diferenciais: [
    {
      icon: "package",
      title: "Entrega digital",
      desc: "Sem frete e sem espera pelos Correios.",
    },
    {
      icon: "clock",
      title: "+10 anos de estufa",
      desc: "Conteúdo de quem cria guppy todo dia.",
    },
    {
      icon: "dna",
      title: "Feito na prática",
      desc: "Do manejo real da criação, não da teoria.",
    },
    {
      icon: "headset",
      title: "Suporte de verdade",
      desc: "Ficou com dúvida? Chame no WhatsApp.",
    },
  ],
  institucionais: [
    {
      titulo: "Sobre a loja",
      texto:
        "A loja nasceu da nossa estufa de guppy de linhagem, em Guarapari/ES, com mais de dez anos de criação.",
      imagem: "/images/estufa.jpg",
      link: { label: "Conheça nossa estrutura", href: "/sobre-nos" },
    },
    {
      titulo: "Como você recebe",
      texto: "É digital: nada é despachado e não existe frete.",
      imagem: null,
      icone: "package",
      checks: ["Sem frete", "Acesso após a confirmação do pagamento"],
    },
    {
      titulo: "Deu algum problema?",
      texto:
        "Se você não conseguir acessar depois do pagamento confirmado, fale com a gente. Resolvemos direto no WhatsApp.",
      imagem: null,
      icone: "shield",
      link: {
        label: "Falar no WhatsApp",
        href: whatsappLink("Olá! Tenho um problema com um produto digital."),
      },
    },
  ],
  faq: [
    {
      pergunta: "Como recebo o produto?",
      resposta:
        "É digital: assim que o pagamento é confirmado, a gente libera o acesso e avisa você.",
    },
    {
      pergunta: "Tem frete?",
      resposta: "Não. Nada é despachado, então não existe frete nem prazo dos Correios.",
    },
    {
      pergunta: "Não consegui acessar. E agora?",
      resposta: "Chame a gente no WhatsApp que resolvemos na hora.",
    },
  ],
  seguranca: [
    { icon: "shield", label: "Pagamento seguro" },
    { icon: "package", label: "Entrega digital" },
    { icon: "clock", label: "Acesso após a confirmação" },
    { icon: "headset", label: "Suporte no WhatsApp" },
  ],
};

const CONTEUDO: Record<VozProduto, ConteudoProduto> = {
  peixe: CONTEUDO_PEIXE,
  vivo: CONTEUDO_VIVO,
  seco: CONTEUDO_SECO,
  digital: CONTEUDO_DIGITAL,
};

/** Conteúdo da página de produto conforme o tipo. Fonte única do texto fixo. */
export function conteudoDoProduto(tipo: string | null | undefined): ConteudoProduto {
  return CONTEUDO[vozDoProduto(tipo)];
}
