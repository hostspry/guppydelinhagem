// Conteúdo estático da página de produto (Leva 1). Texto fixo, reaproveitável;
// os ícones são escolhidos no componente via `icon` (chave → lucide).

import { whatsappLink } from "@/lib/constants";

export const PROVA_SOCIAL_VENDIDOS = "+10 mil guppys vendidos na estufa";
export const PROVA_SOCIAL_CRIADOR =
  "Criador campeão no World Guppy Contest";

export type IconKey =
  | "trophy"
  | "dna"
  | "droplets"
  | "clock"
  | "shield"
  | "truck"
  | "wind"
  | "headset"
  | "package";

// Selos de confiança no topo da compra (4, em linha).
export const SELOS_TOPO: { icon: IconKey; label: string }[] = [
  { icon: "shield", label: "Garantia de chegada viva" },
  { icon: "truck", label: "Envio para todo o Brasil" },
  { icon: "wind", label: "Embalagem com oxigênio" },
  { icon: "headset", label: "Suporte pós-venda" },
];

// Faixa de diferenciais (logo abaixo da compra).
export const DIFERENCIAIS: { icon: IconKey; title: string; desc: string }[] = [
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
];

// Faixa "Sua compra 100% segura" (rodapé do conteúdo).
export const SEGURANCA: { icon: IconKey; label: string }[] = [
  { icon: "shield", label: "Garantia de chegada viva" },
  { icon: "package", label: "Embalagem profissional" },
  { icon: "truck", label: "Envio rápido e rastreado" },
  { icon: "headset", label: "Suporte pós-venda no WhatsApp" },
];

// Nota de credibilidade compacta — integrada ao "Sobre a linhagem" (não é mais
// o painel grande da assinatura). A assinatura completa segue em MARCHEZI_SIGNATURE
// (usada na geração/armazenamento); aqui é a versão curta exibida.
export const MARCHEZI_NOTA =
  "Cada peixe é escolhido à mão na Marchezi Guppy Farm, por um criador premiado no World Guppy Contest, com seleção feita com critério e manejo diário.";

// Blocos institucionais — imagem ao lado do texto, com checks/link conforme o bloco.
export const INSTITUCIONAIS: {
  titulo: string;
  texto: string;
  imagem: string;
  checks?: string[];
  link?: { label: string; href: string };
}[] = [
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
];

// FAQ (Leva 2 — perguntas placeholder, o dono ajusta o conteúdo real).
export const FAQ: { pergunta: string; resposta: string }[] = [
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
];
