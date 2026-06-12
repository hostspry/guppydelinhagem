// Conteúdo estático da página de produto (Leva 1). Texto fixo, reaproveitável;
// os ícones são escolhidos no componente via `icon` (chave → lucide).

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

// Blocos institucionais (Leva 2 — placeholder pré-pronto: imagem + texto).
export const INSTITUCIONAIS: { titulo: string; texto: string }[] = [
  {
    titulo: "Sobre a criação",
    texto:
      "Nossa estufa é dedicada exclusivamente à criação de guppies de linhagem, com seleção genética e acompanhamento diário de cada geração.",
  },
  {
    titulo: "Como enviamos",
    texto:
      "Cada peixe vai em embalagem com oxigênio e proteção térmica, preparado para chegar com segurança em todo o Brasil.",
  },
  {
    titulo: "Garantia de chegada viva",
    texto:
      "Se algo acontecer no transporte, a gente resolve. Sua compra é protegida pela nossa garantia de chegada viva.",
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
];
