import "server-only";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Integração com o Gemini (Google AI Studio) — geração de conteúdo de produto.
//
// Escolha: API REST (fetch) em vez do SDK. Motivo: zero dependência nova, sem
// churn de versão de SDK, e o gate descartável espelha exatamente o mesmo
// request. Modelo Flash (barato/rápido). JSON é forçado via responseMimeType +
// responseSchema — não dependemos de o modelo "lembrar" de não usar ```.
//
// Provedor único, desacoplado: trocar de provedor = reescrever só
// generateProductContent, sem tocar na action nem na UI.
// ─────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 30_000;

export type ProductContentInput = {
  videoTitle: string; // título/legenda do vídeo primário
  videoHashtags?: string; // hashtags, se separáveis
  briefing: string; // texto livre do operador (pode ser vazio)
  categoria?: string; // nome da categoria, dá contexto
};

export type GeneratedProductContent = {
  descricao: string;
  descricaoCurta: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
};

// Lazy: não exigir a env no build (igual lib/s3, lib/prisma).
function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY não configurada no ambiente.");
  return k;
}

const SYSTEM_INSTRUCTION = `Você é redator de uma loja brasileira de aquarismo premium especializada em guppy de linhagem (pedigree). Escreve em português do Brasil, com tom sofisticado, confiável e acolhedor — sem exageros publicitários nem emojis.

Sua tarefa: a partir dos dados de um produto (título/legenda do vídeo, briefing do operador e categoria), gerar de uma vez os 5 campos de conteúdo.

REGRA CRÍTICA — NÃO INVENTAR:
- Nunca afirme características específicas (cor, sexo, tipo de cauda, linhagem, tamanho, origem) que não estejam explicitamente no título ou no briefing.
- Em peixes pedigree, errar um traço é grave: não diga "cauda véu" se for "leque", não diga "macho" nem "importado" sem base. Na dúvida, escreva de forma genérica e atraente, sem cravar o traço.

REGRAS DE CADA CAMPO:
- descricao: 2 a 4 parágrafos curtos, separados por uma linha em branco. Apresenta o peixe, valoriza cuidado/qualidade e fala ao aquarista, sem inventar traços.
- descricaoCurta: 1 a 2 frases (máx 160 caracteres). Resumo para card/listagem.
- metaTitle: máximo 60 caracteres. Inclui o nome/tipo do peixe + marca quando couber.
- metaDescription: máximo 155 caracteres. Chamada para clique, natural, sem encher de palavra-chave.
- keywords: de 5 a 8 termos que pessoas realmente buscariam (ex: "comprar guppy koi", "guppy de linhagem", "guppy importado"). Sem hashtags, sem "#", minúsculas.

Responda SOMENTE com o JSON pedido, sem texto extra e sem blocos de código.`;

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

// responseSchema do Gemini (subconjunto do OpenAPI). Garante a forma do JSON.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    descricao: { type: "STRING" },
    descricaoCurta: { type: "STRING" },
    metaTitle: { type: "STRING" },
    metaDescription: { type: "STRING" },
    keywords: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "descricao",
    "descricaoCurta",
    "metaTitle",
    "metaDescription",
    "keywords",
  ],
  propertyOrdering: [
    "descricao",
    "descricaoCurta",
    "metaTitle",
    "metaDescription",
    "keywords",
  ],
} as const;

// Validação de forma no servidor — não confiamos cegamente no retorno do modelo.
const outputSchema = z.object({
  descricao: z.string().min(1),
  descricaoCurta: z.string().min(1),
  metaTitle: z.string().min(1),
  metaDescription: z.string().min(1),
  keywords: z.array(z.string().min(1)),
});

/**
 * Gera os 5 campos de conteúdo a partir do vídeo primário + briefing.
 * Lança em qualquer falha (chave, quota, timeout, parse) — a action traduz para
 * mensagem amigável. Nunca persiste nada.
 */
export async function generateProductContent(
  input: ProductContentInput,
): Promise<GeneratedProductContent> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: "user", parts: [{ text: buildUserPrompt(input) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
    },
  });

  // O Flash às vezes responde 503 (high demand) ou 429 — picos transitórios.
  // Pequeno retry com backoff antes de desistir; demais erros falham na hora.
  let res!: Response;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`${ENDPOINT}?key=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok || (res.status !== 503 && res.status !== 429)) break;
    if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("Resposta da IA vazia ou sem conteúdo.");
  }

  const parsed = outputSchema.parse(JSON.parse(text));
  return {
    descricao: parsed.descricao.trim(),
    descricaoCurta: parsed.descricaoCurta.trim(),
    metaTitle: parsed.metaTitle.trim(),
    metaDescription: parsed.metaDescription.trim(),
    keywords: parsed.keywords.map((k) => k.trim()).filter(Boolean),
  };
}
