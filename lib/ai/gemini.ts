import "server-only";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Integração com o Gemini (Google AI Studio) — geração de conteúdo de produto.
//
// API REST (fetch), modelo Flash. Dois modos:
//  - SIMPLES (pesquisar=false): força JSON via responseMimeType + responseSchema.
//  - PESQUISA (pesquisar=true): liga o grounding (google_search). A API NÃO
//    permite responseMimeType:application/json junto com tools — retorna HTTP 400
//    "Tool use with a response mime type: 'application/json' is unsupported"
//    (validado no gate). Então, em modo pesquisa, o JSON é instruído por prompt e
//    parseado defensivamente (o modelo costuma cercar em ```json).
//
// Em ambos os modos parseamos defensivamente + validamos a forma com Zod, então
// a geração nunca quebra por causa de cercas/markdown.
//
// Provedor único, desacoplado: trocar de provedor = reescrever só
// generateProductContent, sem tocar na action nem na UI.
// ─────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_SIMPLE_MS = 30_000;
const TIMEOUT_SEARCH_MS = 60_000; // grounding faz buscas — demora mais

export type ProductContentInput = {
  videoTitle: string; // título/legenda do vídeo primário
  videoHashtags?: string; // hashtags, se separáveis
  briefing: string; // texto livre do operador (pode ser vazio)
  categoria?: string; // nome da categoria, dá contexto
  pesquisar?: boolean; // liga o grounding (Google Search) — sob demanda
};

export type GeneratedProductContent = {
  nome: string;
  descricao: string;
  descricaoCurta: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  // Atributos gerais de manejo (ficha técnica) — separados do texto.
  temperatura: string;
  ph: string;
  alimentacao: string;
  expectativaVida: string;
};

// Lazy: não exigir a env no build (igual lib/s3, lib/prisma).
function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY não configurada no ambiente.");
  return k;
}

const SYSTEM_BASE = `Você é redator de uma loja brasileira de aquarismo especializada em guppy de linhagem (pedigree). Escreve em português do Brasil, sem emojis.

ESTILO DA DESCRIÇÃO — CRÍTICO: escreva como DESCRIÇÃO DE PRODUTO de e-commerce — frases curtas, diretas, escaneáveis e amigáveis. Diga o que o peixe É, sem floreio. É PROIBIDA linguagem literária ou rebuscada: nada de "beleza singular", "testemunho da dedicação", "estética deslumbrante", "permita-se desfrutar" e similares. Exemplo do tom desejado: "Trio de Guppy Koi Tuxedo, linhagem premium. Padrão Koi em laranja, vermelho e branco; metade traseira preta (efeito Tuxedo). Machos com cores intensas e nadadeiras grandes."

PRIORIDADE DAS FONTES:
- O BRIEFING do operador descreve o peixe DESTE produto e tem PRIORIDADE. O título do vídeo é apenas contexto auxiliar; se conflitar com o briefing, ignore o título do vídeo. Nunca combine características contraditórias das duas fontes (ex.: não funda "tuxedo" do título com "japan blue" do briefing).
- Quando não houver briefing, o título do vídeo é a fonte principal.

REGRA CRÍTICA — NÃO INVENTAR:
- Nunca afirme características específicas (cor, sexo, tipo de cauda, linhagem, tamanho, origem) sem base no briefing/título — ou, quando a pesquisa estiver ativa, nas fontes encontradas. Na dúvida, mantenha genérico. Em peixes pedigree, errar um traço é grave: não diga "cauda véu" se for "leque", nem "macho"/"importado" sem base.

CAMPOS (gere todos de uma vez):
- nome: nome de produto claro e comercial (ex: "Guppy Koi Tuxedo — Trio Linhagem Importada"). Conciso, sem exageros.
- descricao: 2 a 3 parágrafos CURTOS e diretos, sobre a linhagem, o padrão de cor e as características visíveis. NÃO inclua no texto parâmetros de água, pH, temperatura, alimentação, porte ou expectativa de vida — esses vão em campos separados (ficha técnica).
- descricaoCurta: 1 a 2 frases (máx 160 caracteres).
- metaTitle: no máximo 58 caracteres.
- metaDescription: no máximo 150 caracteres.
- keywords: de 5 a 8 termos que pessoas buscariam, minúsculas, sem "#".
- temperatura, ph, alimentacao, expectativaVida: dados de manejo da espécie/linhagem para a ficha técnica (ex.: temperatura "22–28°C", ph "6.8–7.8", alimentacao "Onívoro", expectativaVida "2–3 anos"). Use dados confiáveis (da pesquisa quando ativa). Se não tiver base para algum, deixe a string vazia — NÃO invente.`;

const SEARCH_BLOCK = `

PESQUISA WEB ATIVA: use a busca para confirmar a linhagem (origem, padrão de cor genético) e o manejo (temperatura, pH, alimentação, expectativa de vida). Priorize fontes especializadas em inglês e da Ásia (Tailândia, Japão, China, Taiwan), incluindo criadores e lojas de referência. Os dados de manejo vão nos CAMPOS estruturados (temperatura, ph, alimentacao, expectativaVida), não no texto da descrição. Traga só o que encontrar; se faltar um dado, deixe o campo vazio — não invente.`;

const JSON_BLOCK = `

FORMATO DE SAÍDA — responda APENAS com um objeto JSON válido, sem nenhum texto antes ou depois, sem comentários e sem blocos de código (não use crases). As chaves devem ser exatamente: nome, descricao, descricaoCurta, metaTitle, metaDescription, keywords (array de strings), temperatura, ph, alimentacao, expectativaVida (strings; vazias quando não houver dado).`;

function buildSystemInstruction(pesquisar: boolean): string {
  return SYSTEM_BASE + (pesquisar ? SEARCH_BLOCK : "") + JSON_BLOCK;
}

function buildUserPrompt(input: ProductContentInput): string {
  const linhas = [
    `Título/legenda do vídeo: ${input.videoTitle || "(não informado)"}`,
  ];
  if (input.videoHashtags?.trim()) {
    linhas.push(`Hashtags do vídeo: ${input.videoHashtags.trim()}`);
  }
  if (input.categoria?.trim()) {
    linhas.push(`Categoria: ${input.categoria.trim()}`);
  }
  linhas.push(
    `Briefing do operador: ${input.briefing.trim() || "(vazio — seja atraente porém genérico, sem inventar traços específicos)"}`,
  );
  return linhas.join("\n");
}

// responseSchema do Gemini (só no modo SIMPLES — incompatível com tools/grounding).
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    nome: { type: "STRING" },
    descricao: { type: "STRING" },
    descricaoCurta: { type: "STRING" },
    metaTitle: { type: "STRING" },
    metaDescription: { type: "STRING" },
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    temperatura: { type: "STRING" },
    ph: { type: "STRING" },
    alimentacao: { type: "STRING" },
    expectativaVida: { type: "STRING" },
  },
  // Só os essenciais são obrigatórios; os de manejo podem vir vazios/omitidos.
  required: [
    "nome",
    "descricao",
    "descricaoCurta",
    "metaTitle",
    "metaDescription",
    "keywords",
  ],
  propertyOrdering: [
    "nome",
    "descricao",
    "descricaoCurta",
    "metaTitle",
    "metaDescription",
    "keywords",
    "temperatura",
    "ph",
    "alimentacao",
    "expectativaVida",
  ],
} as const;

// Validação de forma no servidor — não confiamos cegamente no retorno do modelo.
const outputSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().min(1),
  descricaoCurta: z.string().min(1),
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  keywords: z.array(z.string().min(1)),
  temperatura: z.string().optional().default(""),
  ph: z.string().optional().default(""),
  alimentacao: z.string().optional().default(""),
  expectativaVida: z.string().optional().default(""),
});

/**
 * Parse defensivo: o modo pesquisa costuma cercar o JSON em ```json … ```, e às
 * vezes o texto vem em múltiplas parts. Limpa cercas e recorta do primeiro "{"
 * ao último "}". Funciona também para o JSON puro do modo simples.
 */
function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  t = t
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i !== -1 && j !== -1 && j > i) t = t.slice(i, j + 1);
  return JSON.parse(t);
}

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
};

/**
 * Gera os 6 campos de conteúdo a partir do vídeo primário + briefing.
 * `pesquisar` liga o grounding (Google Search). Lança em qualquer falha (chave,
 * quota, timeout, parse) — a action traduz para mensagem amigável. Nunca persiste.
 */
export async function generateProductContent(
  input: ProductContentInput,
): Promise<GeneratedProductContent> {
  const pesquisar = input.pesquisar === true;

  const requestBody: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: buildSystemInstruction(pesquisar) }],
    },
    contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
  };

  if (pesquisar) {
    // Grounding: tools google_search. SEM responseMimeType/responseSchema
    // (a API rejeita a combinação) — o JSON é garantido pelo prompt + parse.
    requestBody.tools = [{ google_search: {} }];
    requestBody.generationConfig = { temperature: 0.7 };
  } else {
    requestBody.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
    };
  }

  const body = JSON.stringify(requestBody);
  const timeout = pesquisar ? TIMEOUT_SEARCH_MS : TIMEOUT_SIMPLE_MS;

  // O Flash às vezes responde 503 (high demand) ou 429 — picos transitórios.
  // Pequeno retry com backoff antes de desistir; demais erros falham na hora.
  let res!: Response;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`${ENDPOINT}?key=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(timeout),
    });
    if (res.ok || (res.status !== 503 && res.status !== 429)) break;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  // O grounding pode devolver o texto em múltiplas parts — junta todas.
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text)
    .filter((t): t is string => typeof t === "string")
    .join("");
  if (text.trim() === "") {
    throw new Error("Resposta da IA vazia ou sem conteúdo.");
  }

  const parsed = outputSchema.parse(parseJsonLoose(text));
  return {
    nome: parsed.nome.trim(),
    descricao: parsed.descricao.trim(),
    descricaoCurta: parsed.descricaoCurta.trim(),
    metaTitle: parsed.metaTitle.trim(),
    metaDescription: parsed.metaDescription.trim(),
    keywords: parsed.keywords.map((k) => k.trim()).filter(Boolean),
    temperatura: parsed.temperatura.trim(),
    ph: parsed.ph.trim(),
    alimentacao: parsed.alimentacao.trim(),
    expectativaVida: parsed.expectativaVida.trim(),
  };
}
