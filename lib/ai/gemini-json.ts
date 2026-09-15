import "server-only";
import { tratarErroGemini, usoDaResposta } from "./uso";

/**
 * Chamada ao Gemini que devolve JSON com forma garantida por schema.
 *
 * Mesmo provedor e mesmo modelo de lib/ai/gemini.ts (Flash, REST, retry em
 * 503/429). Separado para os textos do Mercado Livre não dependerem do
 * formato da geração de produto.
 */

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY não configurada no ambiente.");
  return k;
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: Parameters<typeof usoDaResposta>[0];
};

export type UsoGemini = { entrada: number; saida: number };

export async function gerarJsonGemini<T>(params: {
  sistema: string;
  usuario: string;
  schema: Record<string, unknown>;
  temperatura?: number;
  timeoutMs?: number;
  /**
   * Teto de tokens de raciocínio. O Flash pensa por conta própria e isso é o
   * grosso do custo e da demora; revisão de texto não precisa pensar nada.
   */
  pensamento?: number;
}): Promise<{ dados: T; uso: UsoGemini }> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: params.sistema }] },
    contents: [{ role: "user", parts: [{ text: params.usuario }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: params.schema,
      temperature: params.temperatura ?? 0.6,
      ...(params.pensamento !== undefined
        ? { thinkingConfig: { thinkingBudget: params.pensamento } }
        : {}),
    },
  });

  // O Flash às vezes responde 503 (alta demanda) ou 429. Tenta de novo um pouco
  // antes de desistir; os outros erros falham na hora.
  let res!: Response;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    res = await fetch(`${ENDPOINT}?key=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(params.timeoutMs ?? 45_000),
    });
    if (res.ok || (res.status !== 503 && res.status !== 429)) break;
    if (tentativa < 2) await new Promise((r) => setTimeout(r, 1500 * (tentativa + 1)));
  }
  if (!res.ok) {
    const erro = await res.text().catch(() => "");
    throw new Error(await tratarErroGemini(res.status, erro));
  }

  const data = (await res.json()) as GeminiResponse;
  const texto = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!texto) throw new Error("A IA respondeu vazio.");

  return { dados: JSON.parse(texto) as T, uso: usoDaResposta(data.usageMetadata) };
}
