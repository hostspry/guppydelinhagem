import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Conta o gasto da IA no próprio site.
 *
 * Preço do Gemini 2.5 Flash, plano pago (tabela oficial, conferida em
 * 2026-09-15): US$ 0,30 por milhão de tokens de entrada e US$ 2,50 por milhão
 * de saída, com os tokens de raciocínio contando como saída. Se o Google mudar
 * o preço, o custo estimado muda aqui; o saldo real continua no AI Studio.
 */
const PRECO_POR_MILHAO: Record<string, { entrada: number; saida: number }> = {
  "gemini-2.5-flash": { entrada: 0.3, saida: 2.5 },
};

export const MODELO_PADRAO = "gemini-2.5-flash";

/** Onde o dono compra crédito e vê o saldo de verdade. */
export const URL_CREDITOS_GEMINI = "https://aistudio.google.com/billing";
export const URL_USO_GEMINI = "https://aistudio.google.com/usage";

export function custoUsd(modelo: string, entrada: number, saida: number): number {
  const p = PRECO_POR_MILHAO[modelo] ?? PRECO_POR_MILHAO[MODELO_PADRAO];
  return (entrada * p.entrada + saida * p.saida) / 1_000_000;
}

/** Nunca lança: registrar o gasto não pode derrubar a função que usou a IA. */
export async function registrarUsoIa(params: {
  funcao: string;
  uso: { entrada: number; saida: number };
  modelo?: string;
}): Promise<void> {
  const modelo = params.modelo ?? MODELO_PADRAO;
  try {
    await prisma.usoIa.create({
      data: {
        funcao: params.funcao,
        modelo,
        tokensEntrada: params.uso.entrada,
        tokensSaida: params.uso.saida,
        custoUsd: custoUsd(modelo, params.uso.entrada, params.uso.saida),
      },
    });
  } catch (e) {
    console.error("[ia] não registrei o uso", e);
  }
}

/**
 * O Google recusa com 429 "prepayment credits are depleted" quando o crédito
 * acaba. Marca a data para Configurações avisar, e devolve a mensagem que o
 * dono entende.
 */
export async function tratarErroGemini(status: number, corpo: string): Promise<string> {
  if (status === 429 && /credit|prepay|billing|quota exceeded/i.test(corpo)) {
    await prisma.configuracaoIa
      .upsert({
        where: { id: "default" },
        create: { id: "default", semCreditoEm: new Date() },
        update: { semCreditoEm: new Date() },
      })
      .catch(() => {});
    return "Os créditos do Gemini acabaram (ou chegaram no limite). Compre mais em Configurações → IA.";
  }
  return `Gemini ${status}: ${corpo.slice(0, 300)}`;
}

/** Tokens gastos de uma resposta do Gemini (raciocínio conta como saída). */
export function usoDaResposta(meta?: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
}): { entrada: number; saida: number } {
  return {
    entrada: meta?.promptTokenCount ?? 0,
    saida: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
}
