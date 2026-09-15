import "server-only";
import { z } from "zod";
import { registrarUsoIa, tratarErroGemini, usoDaResposta } from "./uso";

// ─────────────────────────────────────────────────────────────
// Leitura da conversa de uma venda fechada no WhatsApp.
//
// Entra o texto copiado da conversa ou prints dela; sai o cliente (nome,
// documento, endereço) e o que ele comprou, já ligado ao catálogo.
//
// Mesmo padrão do comprovante: Flash multimodal, JSON forçado por schema,
// validação com Zod na volta. A IA só PROPÕE: a tela mostra tudo para o dono
// conferir antes de salvar o pedido.
//
// O preço que vale é o que o cliente PAGOU. O catálogo serve para achar o
// produto, nunca para decidir quanto a venda custou.
// ─────────────────────────────────────────────────────────────

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 60_000;

export const MIMES_PRINT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

/** A tela reduz os prints antes de mandar; a action do Next aceita até 10 MB no total. */
export const MAX_BYTES_PRINTS = 9 * 1024 * 1024;
export const MAX_PRINTS = 6;

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY não configurada no ambiente.");
  return k;
}

export type ProdutoCatalogo = {
  id: string;
  nome: string;
  tipo: string;
  preco: number;
  variantes: { composicao: string; rotulo: string | null; preco: number }[];
};

export type ItemLido = {
  /** Id do catálogo, ou null quando nada serviu (vira item avulso). */
  produtoId: string | null;
  composicao: string | null;
  /** Como o cliente chamou o item na conversa. */
  descricao: string;
  quantidade: number;
  /** Preço unitário pago, quando a conversa diz. */
  precoUnitario: number | null;
};

export type ConversaLida = {
  cliente: {
    nome: string;
    cpfCnpj: string;
    email: string;
    telefone: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  itens: ItemLido[];
  frete: number | null;
  desconto: number | null;
  /** Valor total que o cliente pagou ou combinou pagar. */
  totalPago: number | null;
  jaPago: boolean;
  formaPagamento: "PIX" | "CARTAO" | "DINHEIRO" | "BOLETO" | "OUTRO" | null;
  observacoes: string | null;
  confianca: "ALTA" | "MEDIA" | "BAIXA";
  aviso: string | null;
};

const COMPOSICOES = ["TRIO", "CASAL", "MACHO", "FEMEA", "LOTE"] as const;
const FORMAS = ["PIX", "CARTAO", "DINHEIRO", "BOLETO", "OUTRO"] as const;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    nome: { type: "string" },
    cpfCnpj: { type: "string" },
    email: { type: "string" },
    telefone: { type: "string" },
    cep: { type: "string" },
    logradouro: { type: "string" },
    numero: { type: "string" },
    complemento: { type: "string" },
    bairro: { type: "string" },
    cidade: { type: "string" },
    uf: { type: "string" },
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          composicao: { type: "string", enum: [...COMPOSICOES] },
          descricao: { type: "string" },
          quantidade: { type: "integer" },
          precoUnitario: { type: "number" },
        },
        required: ["descricao", "quantidade"],
      },
    },
    frete: { type: "number" },
    desconto: { type: "number" },
    totalPago: { type: "number" },
    jaPago: { type: "boolean" },
    formaPagamento: { type: "string", enum: [...FORMAS] },
    observacoes: { type: "string" },
    confianca: { type: "string", enum: ["ALTA", "MEDIA", "BAIXA"] },
    aviso: { type: "string" },
  },
  required: ["itens", "jaPago", "confianca"],
} as const;

const texto = z.string().optional();
const outputSchema = z.object({
  nome: texto,
  cpfCnpj: texto,
  email: texto,
  telefone: texto,
  cep: texto,
  logradouro: texto,
  numero: texto,
  complemento: texto,
  bairro: texto,
  cidade: texto,
  uf: texto,
  itens: z
    .array(
      z.object({
        ref: texto,
        composicao: z.enum(COMPOSICOES).optional(),
        descricao: z.string(),
        quantidade: z.number(),
        precoUnitario: z.number().optional(),
      }),
    )
    .default([]),
  frete: z.number().optional(),
  desconto: z.number().optional(),
  totalPago: z.number().optional(),
  jaPago: z.boolean().default(false),
  formaPagamento: z.enum(FORMAS).optional(),
  observacoes: texto,
  confianca: z.enum(["ALTA", "MEDIA", "BAIXA"]),
  aviso: texto,
});

const brl = (n: number) => n.toFixed(2);

/**
 * O catálogo vai com referência curta (P1, P2...) em vez do id do banco: o id é
 * longo, gasta token e o modelo erra letra ao copiar. A volta é traduzida aqui.
 */
function listaCatalogo(catalogo: ProdutoCatalogo[]): string {
  return catalogo
    .map((p, i) => {
      const comps = p.variantes.length
        ? ` | composições: ${p.variantes
            .map(
              (v) =>
                `${v.composicao}${v.rotulo ? ` "${v.rotulo}"` : ""} R$ ${brl(v.preco)}`,
            )
            .join("; ")}`
        : ` | R$ ${brl(p.preco)}`;
      return `P${i + 1} | ${p.nome} | ${p.tipo.toLowerCase()}${comps}`;
    })
    .join("\n");
}

function instrucao(catalogo: ProdutoCatalogo[]): string {
  return `Você lê conversas de WhatsApp de um criadouro de peixes guppy no Brasil. A venda já foi fechada na conversa e você extrai os dados para montar o pedido. A conversa pode vir como texto copiado ou como prints da tela.

Devolva SEMPRE um JSON com os campos do schema. Campo que você não leu com segurança fica FORA do JSON. Nunca invente.

1. CLIENTE: os dados de quem vai RECEBER a encomenda. É o bloco que o cliente manda com nome, CPF, endereço e telefone. Não use os dados do criadouro (quem vende).
   - cpfCnpj, cep e telefone: só os dígitos. Telefone com DDD, sem o 55 do país.
   - uf: a sigla de 2 letras, mesmo que o cliente escreva o estado por extenso.
   - logradouro sem o número; número em "numero"; apartamento, bloco e casa em "complemento".
   - Nome como o cliente escreveu, com maiúsculas de nome próprio.

2. ITENS: o que o cliente COMPROU no fim da conversa. Ignore o que ele só perguntou, o que ficou de fora e o que ele desistiu.
   - Procure cada item no CATÁLOGO abaixo e ponha em "ref" a referência (P1, P2...). O cliente escreve de forma solta ("o koi", "aquele full red", "tuxedo azul"): compare pelo nome da linhagem. Só preencha "ref" quando tiver certeza razoável de que é aquele produto. Em dúvida entre dois, deixe "ref" fora e diga em "aviso".
   - Peixe: "composicao" é TRIO, CASAL, MACHO, FEMEA ou LOTE, conforme o que ele levou, e precisa existir entre as composições daquele produto. "2 trios" é quantidade 2 com composicao TRIO. Sem dizer a composição, use a que o catálogo tiver e avise.
   - "descricao": como o item aparece na conversa, curto.
   - "precoUnitario": o preço de UMA unidade que o cliente PAGOU ou combinou, se a conversa disser. Pode ser diferente do catálogo (desconto, promoção, preço combinado): o que vale é o da conversa. Se a conversa só disser o total, deixe o preço dos itens fora e ponha o total em "totalPago".

3. VALORES: use ponto como decimal (150.50).
   - "frete": o valor do frete combinado, se aparecer.
   - "desconto": só quando a conversa falar em desconto em reais sobre o total.
   - "totalPago": o valor total que o cliente pagou ou vai pagar, com frete, se aparecer.

4. PAGAMENTO: "jaPago" é true só quando há sinal claro de que o dinheiro entrou (comprovante de Pix na conversa, "paguei", "pix feito", o vendedor confirmando o recebimento). Combinado para pagar depois é false. "formaPagamento" quando der para saber.

5. OBSERVACOES: só o que ajuda a despachar: prazo ou semana pedida para envio, pedido de embalagem, retirada. Curto, sem repetir endereço nem itens.

6. CONFIANCA: ALTA quando cliente, itens e valores estão claros. MEDIA quando algo foi deduzido. BAIXA quando falta muito ou a conversa é confusa. Em "aviso", diga em uma frase o que o dono precisa conferir.

CATÁLOGO (ref | nome | tipo | composições e preços de tabela):
${listaCatalogo(catalogo)}`;
}

function parseJsonLoose(t: string): unknown {
  let s = t.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i !== -1 && j > i) s = s.slice(i, j + 1);
  return JSON.parse(s);
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: Parameters<typeof usoDaResposta>[0];
};

export type EntradaConversa = {
  texto?: string;
  imagens?: { base64: string; mimeType: string }[];
};

const valorPositivo = (n: number | undefined) =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;

export async function lerConversa(
  entrada: EntradaConversa,
  catalogo: ProdutoCatalogo[],
): Promise<ConversaLida> {
  const parts: Record<string, unknown>[] = [];
  if (entrada.texto?.trim()) {
    parts.push({
      text: `Conversa copiada do WhatsApp:\n\n"""\n${entrada.texto.slice(0, 20000)}\n"""`,
    });
  }
  if (entrada.imagens?.length) {
    parts.push({
      text: `${entrada.imagens.length} print(s) da conversa, na ordem em que foram enviados.`,
    });
    for (const img of entrada.imagens) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: instrucao(catalogo) }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
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
    if (tentativa < 2) await new Promise((r) => setTimeout(r, 1500 * (tentativa + 1)));
  }
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(await tratarErroGemini(res.status, err));
  }

  const data = (await res.json()) as GeminiResponse;
  await registrarUsoIa({ funcao: "conversa-venda", uso: usoDaResposta(data.usageMetadata) });
  const saida = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text)
    .filter((t): t is string => typeof t === "string")
    .join("");
  if (!saida.trim()) throw new Error("A IA não devolveu conteúdo.");

  const lido = outputSchema.parse(parseJsonLoose(saida));
  const limpa = (s: string | undefined) => (s ?? "").trim();

  const itens: ItemLido[] = lido.itens.map((it) => {
    // Referência inventada ou composição que o produto não tem é descartada:
    // item avulso é melhor do que item ligado ao peixe errado.
    const m = /^P(\d+)$/i.exec(limpa(it.ref));
    const prod = m ? catalogo[Number(m[1]) - 1] : undefined;
    const comp =
      prod && it.composicao && prod.variantes.some((v) => v.composicao === it.composicao)
        ? it.composicao
        : (prod?.variantes[0]?.composicao ?? null);
    return {
      produtoId: prod?.id ?? null,
      composicao: prod ? comp : null,
      descricao: limpa(it.descricao),
      quantidade: Math.max(1, Math.round(it.quantidade) || 1),
      precoUnitario: valorPositivo(it.precoUnitario),
    };
  });

  return {
    cliente: {
      nome: limpa(lido.nome),
      cpfCnpj: limpa(lido.cpfCnpj),
      email: limpa(lido.email).toLowerCase(),
      telefone: limpa(lido.telefone),
      cep: limpa(lido.cep),
      logradouro: limpa(lido.logradouro),
      numero: limpa(lido.numero),
      complemento: limpa(lido.complemento),
      bairro: limpa(lido.bairro),
      cidade: limpa(lido.cidade),
      uf: limpa(lido.uf).toUpperCase(),
    },
    itens,
    frete: valorPositivo(lido.frete),
    desconto: valorPositivo(lido.desconto),
    totalPago: valorPositivo(lido.totalPago),
    jaPago: lido.jaPago,
    formaPagamento: lido.formaPagamento ?? null,
    observacoes: limpa(lido.observacoes) || null,
    confianca: lido.confianca,
    aviso: limpa(lido.aviso) || null,
  };
}
