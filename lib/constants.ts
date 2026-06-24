export const WHATSAPP_PHONE = "5527996024171";
export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_PHONE}`;
export const WHATSAPP_DISPLAY = "27 99602-4171";

/** Monta uma URL do WhatsApp com mensagem pré-preenchida. */
export function whatsappLink(mensagem: string): string {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(mensagem)}`;
}

// ── Retirada local (cliente busca presencialmente em Guarapari/ES) ───────────
// Endereço da loja usado como receiver_address no additional_info do cartão
// quando o pedido é RETIRADA (é factualmente onde o cliente recebe). Client-safe.
// O CEP bate com FRETE_CONFIG.cepOrigem (origem do frete).
export const LOJA_ENDERECO = {
  cep: "29201010",
  uf: "ES",
  cidade: "Guarapari",
  logradouro: "Marchezi Guppy Farm",
  numero: "s/n",
};

// Texto padrão sugerido para as instruções de retirada (editável no admin).
export const RETIRADA_INSTRUCOES_PADRAO =
  "Após a confirmação do pagamento, combine o horário pelo WhatsApp. A retirada é presencial, na Marchezi Guppy Farm, em Guarapari/ES.";

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
export const MARCHEZI_SIGNATURE = `Criados na Marchezi Guppy Farm, em Guarapari/ES, numa estrutura feita só para guppies de linhagem. Cada peixe vem de anos de seleção, manejo atento e acompanhamento diário, geração após geração.

A água é monitorada, o ambiente é controlado e a alimentação é caprichada desde o nascimento. Quem cuida de tudo é um criador premiado no World Guppy Contest, então o peixe chega até você saudável, forte e no padrão da linhagem.

Mais do que criar, a gente preserva e melhora cada linhagem com trabalho sério e muita paixão, para levar bons guppys a aquaristas do Brasil inteiro.`;

// Frase de abertura da assinatura — usada para localizar e remover a assinatura
// da descrição de forma robusta (independe de variações de espaços/quebras de
// linha em produtos antigos). O card destacado mostra a assinatura uma vez.
export const MARCHEZI_SIGNATURE_START = "Criados na Marchezi Guppy Farm";

// Aberturas de assinaturas ANTIGAS ainda presentes em produtos salvos no banco.
// O strip precisa reconhecê-las até que uma migração atualize as descrições.
const MARCHEZI_SIGNATURE_STARTS_LEGADO = [
  "Criados com excelência na Marchezi Guppy Farm",
];

/** Remove a assinatura Marchezi do texto da descrição (evita duplicar com o card). */
export function stripMarcheziSignature(texto: string): string {
  const candidatos = [MARCHEZI_SIGNATURE_START, ...MARCHEZI_SIGNATURE_STARTS_LEGADO];
  let corte = -1;
  for (const inicio of candidatos) {
    const i = texto.indexOf(inicio);
    if (i >= 0 && (corte === -1 || i < corte)) corte = i;
  }
  return (corte >= 0 ? texto.slice(0, corte) : texto).trim();
}
