export const WHATSAPP_PHONE = "5527996024171";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}`;
export const WHATSAPP_DISPLAY = "27 99602-4171";

/** Monta uma URL do WhatsApp com mensagem pré-preenchida. */
export function whatsappLink(mensagem: string): string {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(mensagem)}`;
}

// Limite de peixes por caixa (frete único até esse número). Client-safe aqui —
// lib/shipping.ts (server-only) reexporta no FRETE_CONFIG. Acima disso, o
// carrinho avisa para falar no WhatsApp (sem bloquear).
export const MAX_PEIXES_POR_CAIXA = 10;

// ── Frete aéreo Gollog: tabela FIXA por região (até 10 peixes) ───────────────
// Preço por UF→região. NÃO é segredo (mostrado ao cliente), então fica aqui
// (client-safe) e é a mesma fonte usada no servidor (cobrança) e no checkout.
// Sul/Sudeste/Nordeste → R$80; Norte/Centro-Oeste → R$110.
export const GOLLOG_PRECO_SUL_SUDESTE_NORDESTE = 80;
export const GOLLOG_PRECO_NORTE_CENTRO_OESTE = 110;

const GOLLOG_UF_80 = [
  // Sul + Sudeste + Nordeste
  "PR", "SC", "RS",
  "SP", "RJ", "MG", "ES",
  "BA", "SE", "AL", "PE", "PB", "RN", "CE", "PI", "MA",
];
const GOLLOG_UF_110 = [
  // Norte + Centro-Oeste
  "AC", "AP", "AM", "PA", "RO", "RR", "TO",
  "GO", "MT", "MS", "DF",
];

/** Frete aéreo Gollog (fixo) para a UF, ou null se a UF não for reconhecida. */
export function freteGollog(
  uf: string | null | undefined,
): { preco: number; regiao: string } | null {
  const u = (uf ?? "").trim().toUpperCase();
  if (GOLLOG_UF_80.includes(u)) {
    return { preco: GOLLOG_PRECO_SUL_SUDESTE_NORDESTE, regiao: "Sul/Sudeste/Nordeste" };
  }
  if (GOLLOG_UF_110.includes(u)) {
    return { preco: GOLLOG_PRECO_NORTE_CENTRO_OESTE, regiao: "Norte/Centro-Oeste" };
  }
  return null;
}

// Assinatura institucional fixa da Marchezi. NÃO é gerada nem reescrita pela IA:
// a IA gera só a parte da linhagem e o sistema concatena este bloco ao final da
// descrição (sempre igual). Hoje todos os produtos são peixe — aplica a todos.
export const MARCHEZI_SIGNATURE = `Criados com excelência na Marchezi Guppy Farm, em Guarapari/ES, em uma estrutura profissional projetada exclusivamente para a criação de guppies de linhagem. Nossos peixes são resultado de anos de seleção genética rigorosa, manejo criterioso e acompanhamento diário de cada geração.

Mantidos em ambiente controlado, com sistemas de filtragem, qualidade de água monitorada e alimentação de alto padrão, os exemplares recebem cuidados constantes desde o nascimento. Todo o processo é conduzido por criador premiado internacionalmente no World Guppy Contest, garantindo genética, saúde, vigor e padrão estético superiores.

Mais do que criar guppies, preservamos e aprimoramos linhagens através de um trabalho sério, dedicado e apaixonado, buscando oferecer peixes de qualidade excepcional para aquaristas de todo o Brasil.`;

// Frase de abertura da assinatura — usada para localizar e remover a assinatura
// da descrição de forma robusta (independe de variações de espaços/quebras de
// linha em produtos antigos). O card destacado mostra a assinatura uma vez.
export const MARCHEZI_SIGNATURE_START =
  "Criados com excelência na Marchezi Guppy Farm";

/** Remove a assinatura Marchezi do texto da descrição (evita duplicar com o card). */
export function stripMarcheziSignature(texto: string): string {
  const i = texto.indexOf(MARCHEZI_SIGNATURE_START);
  return (i >= 0 ? texto.slice(0, i) : texto).trim();
}
