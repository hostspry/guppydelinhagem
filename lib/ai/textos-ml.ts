import "server-only";
import { gerarJsonGemini } from "./gemini-json";
import { registrarUsoIa } from "./uso";
import {
  TERMOS_BUSCA,
  problemasTitulo,
  problemasDescricao,
  termosNoTitulo,
  semTravessao,
  palavrasReescritas,
  TITULO_MAX_ML,
} from "@/lib/mercadolivre/texto-ml";
import type { TipoComposicao } from "@/lib/generated/prisma/enums";

/**
 * IA para os textos do anúncio do Mercado Livre: título, descrição e revisão.
 *
 * Três travas, decididas com o dono:
 * - a IA SUGERE; nada vai para o ML sem o dono ver e salvar;
 * - ela só reescreve o texto do produto. Envio, licença e regra da segunda são
 *   blocos do código e entram depois;
 * - toda sugestão passa pelas regras de lib/mercadolivre/texto-ml antes de
 *   aparecer. A que falha é descartada, não mostrada.
 */

export type ContextoProduto = {
  nome: string;
  composicao: TipoComposicao | null;
  rotuloComposicao: string | null;
  receita: { qtdMachos: number; qtdFemeas: number } | null;
  padraoCor: string | null;
  cauda: string | null;
  caracteristica: string | null;
  origem: string | null;
  temperatura: string | null;
  ph: string | null;
  alimentacao: string | null;
  /** Descrição do site, já sem marcação. É a fonte dos fatos. */
  descricaoSite: string;
  tituloAtual: string | null;
  /** Títulos dos outros anúncios do mesmo produto (não pode repetir). */
  outrosTitulos: string[];
  /** Buscas em alta na categoria Peixes do ML. Contexto, não obrigação. */
  tendenciasMl: string[];
};

const VOZ = `Você escreve anúncios para uma loja brasileira de guppy de linhagem (A Marchezi Guppy Farm), em português do Brasil.

Regras de voz, sem exceção:
- Nada de travessão (— ou –). Use vírgula, ponto ou parênteses.
- Nada de palavras infladas: premium, exclusivo, excepcional, incrível, deslumbrante, único, de ponta, superior, top, perfeito.
- Nada de emoji, nada de palavra toda em maiúsculas, nada de exclamação em sequência.
- Frases curtas e concretas. Diga o que o peixe é.

REGRA CRÍTICA: não invente. Cor, cauda, sexo, tamanho, origem e genética só podem aparecer se estiverem nos dados do produto abaixo. Em peixe de linhagem, errar um traço é propaganda enganosa.`;

function dadosDoProduto(c: ContextoProduto): string {
  const linhas = [
    `Nome no site: ${c.nome}`,
    c.rotuloComposicao ? `Composição do anúncio: ${c.rotuloComposicao}` : "",
    c.receita
      ? `Vai na caixa: ${c.receita.qtdMachos} macho(s) e ${c.receita.qtdFemeas} fêmea(s)`
      : "",
    c.padraoCor ? `Padrão de cor: ${c.padraoCor}` : "",
    c.cauda ? `Cauda: ${c.cauda}` : "",
    c.caracteristica ? `Característica: ${c.caracteristica}` : "",
    c.origem ? `Origem: ${c.origem}` : "",
    c.temperatura ? `Temperatura da água: ${c.temperatura}` : "",
    c.ph ? `pH: ${c.ph}` : "",
    c.alimentacao ? `Alimentação: ${c.alimentacao}` : "",
    `Descrição do site (fonte dos fatos):\n${c.descricaoSite || "(vazia)"}`,
  ];
  return linhas.filter(Boolean).join("\n");
}

// ── Títulos ──────────────────────────────────────────────────────────────────

export type OpcaoTitulo = { titulo: string; caracteres: number; termos: string[] };

export async function sugerirTitulosIa(
  c: ContextoProduto,
): Promise<{ opcoes: OpcaoTitulo[]; descartadas: { titulo: string; motivos: string[] }[] }> {
  const termos = TERMOS_BUSCA.map((t) => `${t.termo} (${t.volume}/mês)`).join("; ");
  const sistema = `${VOZ}

Tarefa: sugerir títulos para o anúncio no Mercado Livre. O título é o que mais pesa na busca do ML.

Regras do título:
- Entre 50 e ${TITULO_MAX_ML} caracteres, contando espaços. Conte antes de responder. Título curto desperdiça espaço de busca; passar de ${TITULO_MAX_ML} o ML corta.
- Cada opção deve cobrir MAIS termos de busca que o título atual, ou pelo menos os mesmos. "Peixe Guppy" e "Lebiste" juntos no mesmo título é o que mais rende.
- Tem que ter "Guppy".${c.rotuloComposicao ? ` Tem que ter a palavra "${c.rotuloComposicao}" e não pode citar outra composição (trio, casal, macho, fêmea, lote), a não ser "1 Macho 2 Fêmeas" num trio ou "Macho e Fêmea" num casal.` : ""}
- Comece pelo que a pessoa busca: "Peixe Guppy" tem o maior volume. "Lebiste" é sinônimo muito buscado. "Vivo" e "Aquário" ajudam quem procura bicho vivo.
- Use o nome da linhagem como está no produto (ex.: Albino Red Silverado).
- Proibido: frete, entrega, envio, promoção, oferta, desconto, preço, parcelamento, pix, estoque, novo, lançamento, símbolos (! * # @ $ % |), palavra repetida.
- Primeira letra de cada palavra em maiúscula, o resto minúsculo.

Termos de busca com volume mensal (use os que couberem, sem forçar): ${termos}.

Gere 6 opções DIFERENTES entre si (ordem das palavras, sinônimo, detalhe de cauda ou cor). Para cada uma, liste os termos de busca que ela cobre.`;

  const usuario = `${dadosDoProduto(c)}
Título atual: ${c.tituloAtual ? `${c.tituloAtual} (${c.tituloAtual.length} caracteres; cobre: ${termosNoTitulo(c.tituloAtual).join(", ") || "nenhum termo"})` : "(ainda não publicado)"}
Títulos de outros anúncios deste produto (não repetir): ${c.outrosTitulos.join(" | ") || "(nenhum)"}
Buscas em alta na categoria Peixes do ML: ${c.tendenciasMl.join(", ") || "(sem dados)"}`;

  const { dados, uso } = await gerarJsonGemini<{ titulos?: { titulo?: string }[] }>({
    sistema,
    usuario,
    temperatura: 0.8,
    // Contar caracteres pede um pouco de raciocínio; mais que isso só atrasa.
    pensamento: 1024,
    schema: {
      type: "OBJECT",
      properties: {
        titulos: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              titulo: { type: "STRING" },
              termos: { type: "ARRAY", items: { type: "STRING" } },
            },
            required: ["titulo"],
          },
        },
      },
      required: ["titulos"],
    },
  });
  await registrarUsoIa({ funcao: "ml.titulos", uso });

  const vistos = new Set<string>();
  const opcoes: OpcaoTitulo[] = [];
  const descartadas: { titulo: string; motivos: string[] }[] = [];
  for (const item of dados.titulos ?? []) {
    const titulo = semTravessao((item.titulo ?? "").trim().replace(/\s+/g, " "));
    const chave = titulo.toLowerCase();
    if (!titulo || vistos.has(chave)) continue;
    vistos.add(chave);
    const motivos = problemasTitulo(titulo, {
      composicao: c.composicao,
      outrosTitulos: c.outrosTitulos,
    });
    if (motivos.length > 0) {
      descartadas.push({ titulo, motivos });
      continue;
    }
    // Os termos cobertos são contados aqui, não copiados da IA.
    opcoes.push({ titulo, caracteres: titulo.length, termos: termosNoTitulo(titulo) });
  }

  // Mais termos com mais volume primeiro: é o que traz busca.
  const peso = (o: OpcaoTitulo) =>
    o.termos.reduce((s, t) => s + (TERMOS_BUSCA.find((x) => x.termo === t)?.volume ?? 0), 0);
  opcoes.sort((a, b) => peso(b) - peso(a));

  return { opcoes: opcoes.slice(0, 3), descartadas };
}

// ── Descrição ────────────────────────────────────────────────────────────────

/** Assuntos que são dos blocos fixos: se a IA escrever, sai repetido ou errado. */
const ASSUNTO_DOS_BLOCOS = /\bfrete\b|\benvi(o|amos|ado)\b|\bentreg|\bprazo\b|\bibama\b|\blicen[cç]a\b|segunda-feira|\bcaixa\b/i;

export async function melhorarDescricaoIa(c: ContextoProduto): Promise<string> {
  const sistema = `${VOZ}

Tarefa: escrever a parte da descrição do anúncio no Mercado Livre que fala do PRODUTO.

Formato da resposta:
- "paragrafos": de 3 a 5 parágrafos curtos, cada um com 1 a 3 frases. Só texto, sem markdown.
- "manejo": itens curtos de manejo (água, temperatura, pH, alimentação), só os que estão nos dados. Pode ficar vazio.
- No total, entre 600 e 1500 caracteres.

Conteúdo dos parágrafos, nesta ordem:
1. O que é: a linhagem e a composição. Use "peixe guppy" e "lebiste" uma vez cada, de forma natural.
2. Como é o peixe: padrão de cor e cauda, como estão nos dados. NÃO descreva macho e fêmea separadamente, a não ser que os dados digam a diferença com todas as letras.
3. De onde vem a linhagem e quem cria, se estiver nos dados.

Jeito de escrever:
- Comece direto pelo peixe ("Trio de peixe guppy Albino Red Silverado…"). Nunca comece com "Este anúncio", "Neste anúncio" ou "Apresentamos".
- Números em português: vírgula decimal (pH 6,8 a 7,8), temperatura como "22 a 28 °C".
- Itens de manejo começam com letra maiúscula, sem ponto final ("Temperatura da água de 22 a 28 °C").
- Pode citar a Marchezi Guppy Farm uma vez, sem elogio.

NÃO escreva sobre: envio, frete, entrega, prazo, caixa, licença, IBAMA, dia da semana, preço, pagamento, garantia, contato, WhatsApp, redes sociais, links. Esses assuntos já entram depois, escritos pela loja.`;

  let ultimoErro = "";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const { dados, uso } = await gerarJsonGemini<{ paragrafos?: string[]; manejo?: string[] }>({
      sistema,
      usuario: dadosDoProduto(c) + (ultimoErro ? `\n\nA versão anterior foi recusada porque: ${ultimoErro}. Corrija.` : ""),
      temperatura: 0.6,
      pensamento: 512,
      schema: {
        type: "OBJECT",
        properties: {
          paragrafos: { type: "ARRAY", items: { type: "STRING" } },
          manejo: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["paragrafos"],
      },
    });
    await registrarUsoIa({ funcao: "ml.descricao", uso });

    // Parágrafos e lista vêm separados e quem monta o texto é o código: pedir
    // "texto com linha em branco" fazia a IA devolver tudo num bloco só.
    const limpar = (s: string) => semTravessao(s.replace(/\s+/g, " ").trim());
    const paragrafos = (dados.paragrafos ?? []).map(limpar).filter(Boolean);
    const manejo = (dados.manejo ?? [])
      .map((i) => limpar(i).replace(/^[-•*]\s*/, "").replace(/\.$/, ""))
      .filter(Boolean);
    const texto = [
      ...paragrafos,
      manejo.length ? `Manejo:\n${manejo.map((i) => `- ${i}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const problemas = problemasDescricao(texto);
    if (ASSUNTO_DOS_BLOCOS.test(texto)) problemas.push("falou de envio, prazo ou licença");
    if (problemas.length === 0) return texto;
    ultimoErro = problemas.join(", ");
  }
  throw new Error(`A IA não trouxe uma descrição que passe nas regras (${ultimoErro}). Tente de novo.`);
}

// ── Revisão ortográfica ──────────────────────────────────────────────────────

export type Revisao = { texto: string; mudancas: { de: string; para: string }[] };

export async function revisarTextoIa(
  texto: string,
  tipo: "titulo" | "descricao",
): Promise<Revisao> {
  const sistema = `Você é revisor de português do Brasil.

Corrija SOMENTE: ortografia, acentuação, concordância, crase e pontuação.
NÃO mude palavras corretas, NÃO troque por sinônimo, NÃO reordene, NÃO encurte, NÃO acrescente nada. Mantenha as quebras de linha exatamente como estão.
Nomes de linhagem em inglês (Full Red, Koi, Tuxedo, Albino, Silverado, Halfmoon, Dumbo) estão certos: não traduza nem corrija.
${tipo === "titulo" ? "É um título de anúncio: não existe ponto final, e cada palavra começa com maiúscula de propósito." : ""}
Se não houver erro, devolva o texto igual e a lista de mudanças vazia.`;

  const { dados, uso } = await gerarJsonGemini<{ texto?: string; mudancas?: { de?: string; para?: string }[] }>({
    sistema,
    usuario: texto,
    temperatura: 0,
    // Revisão é mecânica: sem raciocínio fica rápida e barata.
    pensamento: 0,
    schema: {
      type: "OBJECT",
      properties: {
        texto: { type: "STRING" },
        mudancas: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { de: { type: "STRING" }, para: { type: "STRING" } },
            required: ["de", "para"],
          },
        },
      },
      required: ["texto", "mudancas"],
    },
  });
  await registrarUsoIa({ funcao: `ml.revisao.${tipo}`, uso });

  const revisado = (dados.texto ?? "").replace(/\r/g, "").trim();
  if (!revisado) throw new Error("A revisão voltou vazia.");

  // Trava contra reescrita disfarçada de revisão. Acento e pontuação não
  // contam; palavra trocada conta. Mudou muito, recusa em vez de mostrar.
  const { mudadas, total } = palavrasReescritas(texto, revisado);
  if (mudadas > 3 && mudadas / Math.max(1, total) > 0.1) {
    throw new Error("A IA mexeu demais no texto para ser só revisão. Nada foi alterado.");
  }

  return {
    texto: tipo === "titulo" ? revisado.replace(/\.$/, "") : revisado,
    mudancas: (dados.mudancas ?? [])
      .filter((m) => m.de && m.para && m.de !== m.para)
      .map((m) => ({ de: m.de as string, para: m.para as string })),
  };
}
