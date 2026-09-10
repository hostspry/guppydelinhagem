// Mini-parser do markdown que o admin realmente escreve na descrição do produto:
// títulos (###), negrito (**), listas (* ou -) e parágrafos. Nada além disso.
//
// Motivo: a descrição vinha de um editor onde dá para colar markdown, e a página
// jogava o texto cru na tela — o cliente lia "### Criadeira Profissional" e
// "* Capacidade de 6 litros" com os asteriscos à mostra. Puxar uma biblioteca de
// markdown (e um sanitizador junto) para quatro marcações é peso desnecessário;
// aqui o texto vira ESTRUTURA (nunca HTML), então não existe superfície de XSS.

export type TrechoTexto = { texto: string; forte: boolean };

export type BlocoTexto =
  | { tipo: "titulo"; trechos: TrechoTexto[] }
  | { tipo: "paragrafo"; trechos: TrechoTexto[] }
  | { tipo: "lista"; itens: TrechoTexto[][] };

const RE_TITULO = /^#{1,6}\s+(.*)$/;
const RE_ITEM = /^[*-]\s+(.*)$/;

/** Quebra o inline em trechos normais e em negrito (**assim**). */
function trechos(linha: string): TrechoTexto[] {
  const out: TrechoTexto[] = [];
  let resto = linha;
  let m: RegExpExecArray | null;
  const re = /\*\*(.+?)\*\*/;
  while ((m = re.exec(resto))) {
    if (m.index > 0) out.push({ texto: resto.slice(0, m.index), forte: false });
    out.push({ texto: m[1], forte: true });
    resto = resto.slice(m.index + m[0].length);
  }
  if (resto) out.push({ texto: resto, forte: false });
  return out.length > 0 ? out : [{ texto: linha, forte: false }];
}

/**
 * Converte a descrição em blocos renderizáveis. Texto sem nenhuma marcação
 * continua saindo como parágrafos, exatamente como antes.
 */
export function parseDescricao(texto: string): BlocoTexto[] {
  const linhas = texto.replace(/\r\n?/g, "\n").split("\n");
  const blocos: BlocoTexto[] = [];
  let paragrafo: string[] = [];
  let lista: string[] = [];

  function fecharParagrafo() {
    if (paragrafo.length === 0) return;
    blocos.push({ tipo: "paragrafo", trechos: trechos(paragrafo.join("\n")) });
    paragrafo = [];
  }
  function fecharLista() {
    if (lista.length === 0) return;
    blocos.push({ tipo: "lista", itens: lista.map(trechos) });
    lista = [];
  }

  for (const linha of linhas) {
    const l = linha.trim();
    if (l === "") {
      fecharParagrafo();
      fecharLista();
      continue;
    }
    const titulo = RE_TITULO.exec(l);
    if (titulo) {
      fecharParagrafo();
      fecharLista();
      blocos.push({ tipo: "titulo", trechos: trechos(titulo[1].trim()) });
      continue;
    }
    const item = RE_ITEM.exec(l);
    if (item) {
      fecharParagrafo();
      lista.push(item[1].trim());
      continue;
    }
    fecharLista();
    paragrafo.push(l);
  }
  fecharParagrafo();
  fecharLista();
  return blocos;
}

/** Quantos caracteres o texto tem já sem marcação (decide o "Ler mais"). */
export function tamanhoDoTexto(blocos: BlocoTexto[]): number {
  return blocos.reduce((n, b) => {
    if (b.tipo === "lista") {
      return n + b.itens.reduce((m, i) => m + i.reduce((k, t) => k + t.texto.length, 0), 0);
    }
    return n + b.trechos.reduce((m, t) => m + t.texto.length, 0);
  }, 0);
}

/** Texto limpo, sem marcação — para meta description e JSON-LD. */
export function descricaoEmTextoSimples(texto: string): string {
  return parseDescricao(texto)
    .map((b) =>
      b.tipo === "lista"
        ? b.itens.map((i) => i.map((t) => t.texto).join("")).join(". ")
        : b.trechos.map((t) => t.texto).join(""),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
