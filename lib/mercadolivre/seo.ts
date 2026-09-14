/**
 * Título e ficha técnica pensados para a BUSCA DO MERCADO LIVRE.
 *
 * Lá o título é o principal fator de ranqueamento, e ele é curto: 60
 * caracteres. O que funciona no site não funciona lá — "Guppy Koi Tuxedo —
 * Trio Linhagem Premium" gasta caracteres com travessão e com "Premium", que
 * ninguém digita na busca, e deixa de fora "peixe", "lebiste" e "vivo", que são
 * justamente o que as pessoas procuram.
 *
 * Módulo PURO de propósito: título é regra de negócio que erra em silêncio, e
 * assim dá para conferir com os nomes reais do catálogo (scripts/teste-titulo-ml).
 */

/** Limite do ML. Passar disso faz eles cortarem no meio da palavra. */
export const TITULO_MAX_ML = 60;

/**
 * Ruído de vitrine própria: diz da marca, não do produto, e ninguém busca por
 * isso no marketplace. Sai para abrir espaço a termo que traz visita.
 */
const RUIDO = [
  /\blinhagem\s+(premium|selecionada|pura|importada|exclusiva)\b/gi,
  /\blinha\s+premium\b/gi,
  /\bpremium\b/gi,
  /\bselecionad[ao]s?\b/gi,
  /\bexclusiv[ao]s?\b/gi,
  /\bpedigree\b/gi,
];

/** Termos que trazem busca, em ordem de importância. Entram se couber. */
const COMPLEMENTOS = ["Lebiste", "Vivo", "Aquário", "Água Doce"];

/**
 * Palavras de composição que já vêm no nome do site ("Guppy Koi Tuxedo — Trio
 * Linhagem Premium"). Saem da base: quem manda é a composição do anúncio, senão
 * o anúncio do casal sairia com "Trio Casal" no título.
 */
const COMPOSICAO_NO_NOME =
  /\b(trio|casal|macho|machos|f[eê]mea|f[eê]meas|lote)\b/gi;

function limpar(nome: string): string {
  let s = nome;
  // Travessão e parênteses viram espaço: no ML eles só ocupam lugar.
  s = s.replace(/[—–-]/g, " ").replace(/[()[\]]/g, " ");
  for (const r of RUIDO) s = s.replace(r, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Remove palavra repetida mantendo a primeira aparição (ignora acento/caixa). */
function semRepetidas(palavras: string[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const p of palavras) {
    const chave = p
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (chave.length <= 1) continue;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(p);
  }
  return saida;
}

function cabe(partes: string[], extra: string): boolean {
  return [...partes, extra].join(" ").length <= TITULO_MAX_ML;
}

/**
 * Monta o título do anúncio de peixe.
 *
 * Ordem pensada para a busca: o que a pessoa digita primeiro vem primeiro.
 * "Peixe Guppy <linhagem> <composição>" e, com o que sobrar, os complementos.
 */
export function tituloPeixeMl(params: {
  nome: string;
  /** "Trio", "Casal", "Macho"… já no rótulo de exibição. */
  composicao?: string | null;
}): string {
  const base = limpar(params.nome.replace(COMPOSICAO_NO_NOME, " "));
  const palavras = base.split(" ").filter(Boolean);

  // "Peixe" e "Guppy" na frente: são os dois termos mais buscados, e o nome do
  // produto nem sempre traz o primeiro.
  const inicio: string[] = [];
  if (!/\bpeixe\b/i.test(base)) inicio.push("Peixe");
  if (!/\bguppy\b/i.test(base)) inicio.push("Guppy");

  // A composição é INEGOCIÁVEL: é o que separa o anúncio do trio do anúncio do
  // macho na mesma busca. Reserva o espaço dela antes de gastar com linhagem —
  // sem isso, o nome comprido empurrava a composição para fora e dois anúncios
  // diferentes saíam com títulos idênticos.
  const composicao = params.composicao?.split(" ")[0] ?? "";
  const reserva = composicao ? composicao.length + 1 : 0;

  const cabeNaBase = (partes: string[]) =>
    partes.join(" ").length <= TITULO_MAX_ML - reserva;

  let partes = semRepetidas([...inicio, ...palavras]);
  while (partes.length > 2 && !cabeNaBase(partes)) partes.pop();

  if (composicao) partes = [...partes, composicao];

  for (const extra of COMPLEMENTOS) {
    if (partes.some((p) => p.toLowerCase() === extra.toLowerCase().split(" ")[0]))
      continue;
    if (cabe(partes, extra)) partes = [...partes, extra];
  }

  return partes.join(" ").slice(0, TITULO_MAX_ML).trim();
}

/**
 * Ficha técnica do peixe.
 *
 * Vale mais do que parece: o ML usa os atributos nos FILTROS da busca, e anúncio
 * sem ficha some quando o comprador filtra por espécie, cor ou quantidade. Os
 * três primeiros são obrigatórios; o resto é o que separa aparecer de não
 * aparecer.
 */
export const ML_VALOR = {
  ESPECIE_GUPPY: "3221175",
  AGUA_DOCE: "3221180",
  GENERO_MACHO: "3896960",
  GENERO_FEMEA: "3896959",
  GENERO_MISTO: "4052847",
} as const;

/** Guppy é tropical: 22 a 28 °C. Na lista do ML isso é "Quente". */
const AGUA_QUENTE = "Quente";

/** Cor principal aceita pelo ML, deduzida do padrão de cor da linhagem. */
const CORES: { termos: RegExp; valor: string }[] = [
  { termos: /\b(full\s*red|red|vermelh)/i, valor: "Vermelho" },
  { termos: /\b(blue|azul|japan\s*blue)/i, valor: "Azul" },
  { termos: /\b(yellow|amarel)/i, valor: "Amarelo" },
  { termos: /\b(black|preto|negro)/i, valor: "Preto" },
  { termos: /\b(white|branco|albino|platinum)/i, valor: "Branco" },
  { termos: /\b(green|verde)/i, valor: "Verde" },
  { termos: /\b(purple|violet|roxo|violeta)/i, valor: "Violeta" },
  { termos: /\b(orange|laranja|koi)/i, valor: "Laranja" },
];

export function corPrincipalMl(texto: string): string | null {
  for (const c of CORES) if (c.termos.test(texto)) return c.valor;
  return null;
}

export type AtributoMl = { id: string; value_id?: string; value_name?: string };

export function atributosPeixe(params: {
  genero: string;
  /** Quantos peixes vão na venda (trio = 3). Entra no filtro de quantidade. */
  quantidadePeixes?: number | null;
  /** Nome/padrão de cor, para deduzir a cor principal. */
  textoParaCor?: string | null;
}): AtributoMl[] {
  const attrs: AtributoMl[] = [
    { id: "FISH_SPECIES", value_id: ML_VALOR.ESPECIE_GUPPY },
    { id: "ANIMAL_GENDER", value_id: params.genero },
    { id: "REQUIRED_WATER_TYPE", value_id: ML_VALOR.AGUA_DOCE },
    { id: "REQUIRED_WATER_TEMPERATURE", value_name: AGUA_QUENTE },
  ];

  if (params.quantidadePeixes && params.quantidadePeixes > 0) {
    attrs.push({ id: "FISHES_NUMBER", value_name: String(params.quantidadePeixes) });
  }

  const cor = params.textoParaCor ? corPrincipalMl(params.textoParaCor) : null;
  if (cor) attrs.push({ id: "MAIN_COLOR", value_name: cor });

  return attrs;
}
