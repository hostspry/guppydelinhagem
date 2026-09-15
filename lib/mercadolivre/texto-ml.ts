/**
 * Regras de texto de anúncio do Mercado Livre, sem IA e sem rede.
 *
 * A IA sugere; quem decide se a sugestão pode aparecer na tela é isto. Módulo
 * puro (client-safe) para ter teste (scripts/teste-texto-ml.mts) e para a aba
 * poder avisar enquanto o dono digita.
 */

import type { TipoComposicao } from "@/lib/generated/prisma/enums";

export const TITULO_MAX_ML = 60;
const TITULO_MIN_ML = 20;

/**
 * Termos que as pessoas buscam, com volume mensal estimado (Google, planilha de
 * keyword intelligence de 2026, categoria guppy/lebiste). A planilha fica fora
 * do repositório; o que interessa ao anúncio está aqui.
 */
export const TERMOS_BUSCA: { termo: string; volume: number }[] = [
  { termo: "peixe guppy", volume: 31623 },
  { termo: "guppy", volume: 3162 },
  { termo: "lebiste", volume: 3162 },
  { termo: "peixe lebiste", volume: 3162 },
  { termo: "guppy endler", volume: 3162 },
  { termo: "guppy de linhagem", volume: 316 },
  { termo: "peixe guppy macho", volume: 316 },
  { termo: "peixe guppy femea", volume: 316 },
  { termo: "lebiste femea", volume: 316 },
  { termo: "peixe de aquario guppy", volume: 316 },
  { termo: "guppy full red", volume: 316 },
  { termo: "guppy koi", volume: 316 },
  { termo: "guppy dumbo", volume: 316 },
  { termo: "guppy moscow blue", volume: 316 },
  { termo: "guppy red dragon", volume: 316 },
  { termo: "guppy full black", volume: 316 },
  { termo: "guppy japan blue", volume: 316 },
  { termo: "peixe guppy preço", volume: 316 },
];

/**
 * Proibido em título do ML: frete, pagamento, estoque, condição e promoção
 * (política de títulos deles), mais as palavras infladas que a loja não usa.
 */
const PROIBIDAS_TITULO: { re: RegExp; motivo: string }[] = [
  { re: /\bfrete\b|\bgr[aá]tis\b|\benvio\b|\bentrega\b|\bimediat/i, motivo: "fala de frete ou entrega" },
  { re: /\bpromo|\boferta|\bdesconto|\bbarat|\bmelhor pre|\bliquida/i, motivo: "é promocional" },
  { re: /\bparcel|\bpix\b|\bjuros\b/i, motivo: "fala de pagamento" },
  { re: /\bestoque\b|\bpronta\b|\bdispon[ií]ve/i, motivo: "fala de estoque" },
  { re: /\bnovo\b|\blan[cç]amento\b/i, motivo: "fala de condição" },
  { re: /\bpremium\b|\bexclusiv|\bsuper\b|\btop\b|\bmelhor\b/i, motivo: "tem palavra inflada" },
  { re: /whats|zap\b|\bcontato\b/i, motivo: "pede contato" },
  { re: /[!*#@$%|—–]/, motivo: "tem símbolo que o ML não aceita" },
];

/** Palavra que marca cada composição, e quais não podem aparecer junto. */
const MARCA_COMPOSICAO: Record<TipoComposicao, { exige: RegExp; proibe: RegExp | null }> = {
  TRIO: { exige: /\btrio\b/i, proibe: /\bcasal\b|\blote\b/i },
  CASAL: { exige: /\bcasal\b/i, proibe: /\btrio\b|\blote\b/i },
  MACHO: { exige: /\bmacho\b/i, proibe: /\bf[eê]mea|\bcasal\b|\btrio\b|\blote\b/i },
  FEMEA: { exige: /\bf[eê]mea\b/i, proibe: /\bmacho|\bcasal\b|\btrio\b|\blote\b/i },
  LOTE: { exige: /\blote\b/i, proibe: /\bcasal\b|\btrio\b/i },
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Motivos pelos quais o título não serve. Vazio = pode usar. */
export function problemasTitulo(
  titulo: string,
  ctx: { composicao: TipoComposicao | null; outrosTitulos?: string[] },
): string[] {
  const t = titulo.trim().replace(/\s+/g, " ");
  const erros: string[] = [];

  if (t.length > TITULO_MAX_ML) erros.push(`passa de ${TITULO_MAX_ML} caracteres`);
  if (t.length < TITULO_MIN_ML) erros.push("curto demais");
  if (!/\bguppy\b|\blebiste/i.test(t)) erros.push("não diz guppy nem lebiste");

  for (const p of PROIBIDAS_TITULO) {
    if (p.re.test(t)) erros.push(p.motivo);
  }

  // Palavra inteira em maiúsculas (fora siglas curtas) o ML trata como grito.
  if (t.split(" ").some((w) => w.length > 4 && w === w.toUpperCase() && /[A-Z]/.test(w))) {
    erros.push("tem palavra toda em maiúsculas");
  }

  // Sem a composição, os anúncios do trio e do macho ficam iguais: duplicata.
  if (ctx.composicao) {
    const m = MARCA_COMPOSICAO[ctx.composicao];
    if (!m.exige.test(t)) erros.push("não diz a composição");
    if (m.proibe?.test(t)) erros.push("cita outra composição");
  }

  if ((ctx.outrosTitulos ?? []).some((o) => norm(o) === norm(t))) {
    erros.push("igual ao título de outro anúncio");
  }

  return erros;
}

/** Termos de busca que o título cobre (todas as palavras do termo presentes). */
export function termosNoTitulo(titulo: string): string[] {
  const palavras = new Set(norm(titulo).split(" "));
  return TERMOS_BUSCA.filter((x) => norm(x.termo).split(" ").every((p) => palavras.has(p)))
    .sort((a, b) => b.volume - a.volume)
    .map((x) => x.termo);
}

/** Motivos pelos quais a descrição não serve. Vazio = pode usar. */
export function problemasDescricao(texto: string): string[] {
  const t = texto.trim();
  const erros: string[] = [];
  if (t.length < 200) erros.push("curta demais");
  if (t.length > 50000) erros.push("passa do limite do ML");
  if (/<[a-z][\s\S]*?>/i.test(t)) erros.push("tem HTML");
  // O ML pune contato fora da plataforma: link, e-mail, telefone, rede social.
  if (/https?:\/\/|www\.|\.com\b|\.br\b/i.test(t)) erros.push("tem link");
  if (/[\w.+-]+@[\w-]+\.\w+/.test(t)) erros.push("tem e-mail");
  if (/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/.test(t)) erros.push("tem telefone");
  if (/whats|zap\b|instagram|facebook|telegram/i.test(t)) erros.push("pede contato por fora");
  return erros;
}

/** Travessão vira vírgula: é regra de texto da loja, e a IA insiste nele. */
export function semTravessao(texto: string): string {
  return texto.replace(/\s*[—–]\s*/g, ", ");
}

/**
 * Quantas palavras a "revisão" trocou de verdade. Acento, maiúscula e
 * pontuação não contam: é exatamente o que revisão deve mexer. O que conta é
 * palavra diferente, que é sinal de reescrita disfarçada.
 */
export function palavrasReescritas(antes: string, depois: string): { mudadas: number; total: number } {
  const limpa = (s: string) =>
    s
      .split(/\s+/)
      .map((w) => norm(w).replace(/[^\p{L}\p{N}]/gu, ""))
      .filter(Boolean)
      .join(" ");
  const a = limpa(antes);
  const d = limpa(depois);
  // Cada troca aparece duas vezes (a que saiu e a que entrou): metade é a conta.
  const trocas = diffPalavras(a, d)
    .filter((p) => p.tipo !== "igual")
    .reduce((n, p) => n + p.texto.trim().split(/\s+/).filter(Boolean).length, 0);
  return { mudadas: Math.ceil(trocas / 2), total: a.split(" ").filter(Boolean).length };
}

export type PedacoDiff = { tipo: "igual" | "saiu" | "entrou"; texto: string };

/**
 * Diferença palavra a palavra, para o dono ver o que a revisão mexeu. LCS
 * simples: texto de anúncio tem centenas de palavras, e acima do teto devolve
 * "tudo mudou" em vez de travar a tela.
 */
export function diffPalavras(antes: string, depois: string): PedacoDiff[] {
  const a = antes.split(/(\s+)/);
  const b = depois.split(/(\s+)/);
  if (a.length * b.length > 4_000_000) {
    return [
      { tipo: "saiu", texto: antes },
      { tipo: "entrou", texto: depois },
    ];
  }
  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: PedacoDiff[] = [];
  const push = (tipo: PedacoDiff["tipo"], texto: string) => {
    const ult = out[out.length - 1];
    if (ult && ult.tipo === tipo) ult.texto += texto;
    else out.push({ tipo, texto });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("igual", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push("saiu", a[i++]);
    } else {
      push("entrou", b[j++]);
    }
  }
  while (i < n) push("saiu", a[i++]);
  while (j < m) push("entrou", b[j++]);
  return out;
}
