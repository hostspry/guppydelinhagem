import "server-only";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Leitura de comprovante — texto colado, PDF ou imagem (print/foto).
//
// Mesmo provedor e mesmo padrão de lib/ai/gemini.ts: REST, modelo Flash, JSON
// forçado por responseSchema e validação com Zod na volta. O Flash é multimodal,
// então PDF e imagem vão no MESMO endpoint como inlineData em base64 — não
// precisamos de OCR à parte.
//
// A IA só PROPÕE: nada é salvo direto. O que ela devolve vira rascunho de
// formulário para o dono conferir, porque errar valor de dinheiro é caro e
// comprovante é um documento cheio de números parecidos (valor, tarifa, saldo,
// documento, agência).
// ─────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 45_000;

/** Tipos que o Gemini aceita como inlineData e que fazem sentido aqui. */
export const MIMES_COMPROVANTE = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const MAX_BYTES_COMPROVANTE = 10 * 1024 * 1024; // 10 MB

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY não configurada no ambiente.");
  return k;
}

export type CategoriaDisponivel = {
  slug: string;
  nome: string;
  tipo: "ENTRADA" | "SAIDA" | null;
};

export type ComprovanteLido = {
  tipo: "ENTRADA" | "SAIDA";
  valor: number | null;
  data: string | null; // "AAAA-MM-DD"
  descricao: string;
  contraparte: string | null; // quem pagou ou quem recebeu
  categoriaSlug: string | null;
  observacoes: string | null;
  confianca: "ALTA" | "MEDIA" | "BAIXA";
  aviso: string | null; // o que o modelo não conseguiu ler com segurança
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    tipo: { type: "string", enum: ["ENTRADA", "SAIDA"] },
    valor: { type: "number" },
    data: { type: "string" },
    descricao: { type: "string" },
    contraparte: { type: "string" },
    categoriaSlug: { type: "string" },
    observacoes: { type: "string" },
    confianca: { type: "string", enum: ["ALTA", "MEDIA", "BAIXA"] },
    aviso: { type: "string" },
  },
  required: ["tipo", "descricao", "confianca"],
} as const;

const outputSchema = z.object({
  tipo: z.enum(["ENTRADA", "SAIDA"]),
  valor: z.number().nonnegative().optional(),
  data: z.string().optional(),
  descricao: z.string(),
  contraparte: z.string().optional(),
  categoriaSlug: z.string().optional(),
  observacoes: z.string().optional(),
  confianca: z.enum(["ALTA", "MEDIA", "BAIXA"]),
  aviso: z.string().optional(),
});

function instrucao(categorias: CategoriaDisponivel[], hoje: string): string {
  const lista = categorias
    .map((c) => `- ${c.slug} (${c.nome}${c.tipo ? `, ${c.tipo.toLowerCase()}` : ""})`)
    .join("\n");

  return `Você lê comprovantes financeiros de um criadouro de peixes ornamentais no Brasil e extrai os dados para lançar no caixa.

Devolva SEMPRE um JSON com os campos do schema.

Regras que importam:

1. VALOR: pegue o valor da transação, não o saldo da conta, não a tarifa, não o limite. Em comprovante de Pix é o "valor" ou "valor enviado/recebido". Use ponto como separador decimal (ex: 1234.56). Se houver mais de um valor possível e você não tiver certeza de qual é a transação, deixe "valor" fora e explique em "aviso".

2. TIPO: ENTRADA quando o dinheiro veio para o dono do criadouro (recebimento, venda, Pix recebido, depósito). SAIDA quando o dinheiro saiu (pagamento, compra, boleto pago, Pix enviado, transferência para terceiros). Na dúvida entre os dois, escolha o mais provável, marque confianca BAIXA e explique em "aviso".

3. DATA: formato AAAA-MM-DD, a data em que o dinheiro se moveu. Hoje é ${hoje}. Comprovante brasileiro usa DD/MM/AAAA — não troque dia com mês. Sem data legível, deixe o campo fora.

4. DESCRICAO: curta e útil para quem vai olhar o caixa depois, em português, sem jargão de banco. Ex: "Pix de Maria Silva", "Boleto da conta de luz", "Compra de ração no Mercado Livre". Não repita o valor na descrição.

5. CONTRAPARTE: nome de quem pagou (entrada) ou de quem recebeu (saída), quando aparecer. Pessoa ou empresa, sem CPF/CNPJ.

6. CATEGORIA: escolha UM slug da lista abaixo, o que melhor descreve a natureza do gasto ou do recebimento. Se nenhum servir, deixe o campo fora — é melhor sem categoria do que na errada.
${lista}

7. CONFIANCA: ALTA só quando valor, data e tipo estão claramente legíveis. MEDIA quando um deles foi inferido. BAIXA quando o documento está cortado, ilegível ou é ambíguo.

8. Se o conteúdo não for um comprovante (foto de peixe, print de conversa, página aleatória), devolva confianca BAIXA, descricao vazia e explique em "aviso". Não invente números: campo que você não leu é campo que fica fora do JSON.

9. OBSERVACOES: só o que ajuda a identificar depois (número do documento, banco, forma de pagamento). Nunca copie dados sensíveis completos como CPF, CNPJ ou número de cartão.`;
}

function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const i = t.indexOf("{");
  const j = t.lastIndexOf("}");
  if (i !== -1 && j !== -1 && j > i) t = t.slice(i, j + 1);
  return JSON.parse(t);
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

export type EntradaComprovante =
  | { texto: string }
  | { base64: string; mimeType: string; nomeArquivo?: string };

/** "AAAA-MM-DD" plausível? Barra 2019-13-45 e datas absurdas do modelo. */
function dataValida(iso: string | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [a, m, d] = iso.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (a < 2000 || a > 2100) return null;
  return iso;
}

export async function lerComprovante(
  entrada: EntradaComprovante,
  categorias: CategoriaDisponivel[],
): Promise<ComprovanteLido> {
  const hoje = new Date().toISOString().slice(0, 10);

  const parts: Record<string, unknown>[] =
    "texto" in entrada
      ? [
          {
            text: `Comprovante colado como texto:\n\n"""\n${entrada.texto.slice(0, 8000)}\n"""`,
          },
        ]
      : [
          {
            text: `Comprovante em anexo${entrada.nomeArquivo ? ` (arquivo: ${entrada.nomeArquivo})` : ""}. Leia o documento e extraia os dados.`,
          },
          { inlineData: { mimeType: entrada.mimeType, data: entrada.base64 } },
        ];

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: instrucao(categorias, hoje) }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      // Extração de dado é tarefa de precisão, não de criatividade.
      temperature: 0,
    },
  });

  let res!: Response;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    res = await fetch(`${ENDPOINT}?key=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok || (res.status !== 503 && res.status !== 429)) break;
    if (tentativa < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (tentativa + 1)));
    }
  }

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const texto = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text)
    .filter((t): t is string => typeof t === "string")
    .join("");
  if (texto.trim() === "") throw new Error("A IA não devolveu conteúdo.");

  const lido = outputSchema.parse(parseJsonLoose(texto));
  const slugsValidos = new Set(categorias.map((c) => c.slug));

  return {
    tipo: lido.tipo,
    valor: typeof lido.valor === "number" && lido.valor > 0 ? lido.valor : null,
    data: dataValida(lido.data),
    descricao: lido.descricao.trim(),
    contraparte: lido.contraparte?.trim() || null,
    // Slug inventado pelo modelo é descartado — melhor sem categoria do que com
    // uma que não existe.
    categoriaSlug:
      lido.categoriaSlug && slugsValidos.has(lido.categoriaSlug)
        ? lido.categoriaSlug
        : null,
    observacoes: lido.observacoes?.trim() || null,
    confianca: lido.confianca,
    aviso: lido.aviso?.trim() || null,
  };
}
