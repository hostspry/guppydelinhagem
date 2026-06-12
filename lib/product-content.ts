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
    title: "Seleção genética rigorosa",
    desc: "Linhagens trabalhadas geração após geração.",
  },
  {
    icon: "droplets",
    title: "Ambiente controlado",
    desc: "Água monitorada e manejo criterioso.",
  },
  {
    icon: "clock",
    title: "+10 anos de experiência",
    desc: "Dedicação diária à criação de guppies.",
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
  "Cada peixe é selecionado à mão na Marchezi Guppy Farm — criador premiado no World Guppy Contest, com seleção genética rigorosa e manejo diário.";

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
      "Nossa estufa é dedicada exclusivamente à criação de guppies de linhagem, com seleção genética e acompanhamento diário de cada geração.",
    imagem: "/images/estufa.jpg",
    link: { label: "Conheça nossa estrutura", href: "/sobre-nos" },
  },
  {
    titulo: "Como enviamos",
    texto:
      "Cada peixe vai em embalagem preparada para chegar com segurança em todo o Brasil:",
    imagem: "/images/caixa.png",
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
    imagem: "/images/selo.png",
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
      "Saquinhos com água oxigenada, dentro de caixa de isopor com proteção térmica — o padrão usado por criadores para transporte seguro de peixes.",
  },
  {
    pergunta: "Posso misturar com outras espécies?",
    resposta:
      "Guppies convivem bem com espécies pacíficas de porte similar. Evite peixes grandes ou agressivos. Podemos orientar no WhatsApp.",
  },
];
