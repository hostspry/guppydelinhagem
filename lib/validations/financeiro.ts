import { z } from "zod";

/**
 * Valor em reais digitado por gente: aceita "1.234,56", "1234.56" e "R$ 80".
 * A vírgula é decimal no Brasil; o ponto pode ser milhar ou decimal, então só
 * tratamos o ponto como decimal quando não há vírgula na string.
 */
export function parseValorBR(entrada: string | number): number | null {
  if (typeof entrada === "number") {
    return Number.isFinite(entrada) ? entrada : null;
  }
  const limpo = entrada.replace(/[R$\s ]/gi, "").trim();
  if (!limpo) return null;

  const temVirgula = limpo.includes(",");
  const normalizado = temVirgula
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

const valorSchema = z
  .union([z.string(), z.number()])
  .transform((v) => parseValorBR(v))
  .refine((v): v is number => v !== null && v > 0, {
    message: "Informe um valor maior que zero.",
  })
  .refine((v) => (v ?? 0) <= 9_999_999, { message: "Valor alto demais." });

const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

const opcionalVazio = (s: z.ZodString) =>
  z
    .union([s, z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v == null ? null : v));

export const lancamentoSchema = z.object({
  tipo: z.enum(["ENTRADA", "SAIDA"], { message: "Escolha entrada ou saída." }),
  descricao: z.string().trim().min(2, "Descreva o lançamento."),
  valor: valorSchema,
  data: dataSchema,
  categoriaId: opcionalVazio(z.string()),
  observacoes: opcionalVazio(z.string().trim()),
  comprovanteUrl: opcionalVazio(z.string()),
  /** Preenchido = conta a pagar/receber (nasce PENDENTE até ser quitada). */
  vencimento: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v == null ? null : v)),
  aPagar: z.coerce.boolean().default(false),
});

export type LancamentoInput = z.output<typeof lancamentoSchema>;

export const categoriaFinanceiraSchema = z.object({
  nome: z.string().trim().min(2, "Dê um nome à categoria."),
  tipo: z.enum(["ENTRADA", "SAIDA"], { message: "Escolha entrada ou saída." }),
});

export const recorrenciaSchema = z.object({
  tipo: z.enum(["ENTRADA", "SAIDA"]).default("SAIDA"),
  descricao: z.string().trim().min(2, "Descreva a conta."),
  valor: valorSchema,
  // 1–28 para existir em todo mês, inclusive fevereiro.
  diaVencimento: z.coerce
    .number()
    .int()
    .min(1, "Entre 1 e 28.")
    .max(28, "Use no máximo 28, para o dia existir em todo mês."),
  categoriaId: opcionalVazio(z.string()),
  observacoes: opcionalVazio(z.string().trim()),
  ativa: z.coerce.boolean().default(true),
});

export type RecorrenciaInput = z.output<typeof recorrenciaSchema>;

/** Confirmação de uma venda do site, com os custos que vêm junto. */
export const confirmarVendaSchema = z.object({
  data: dataSchema,
  taxaGateway: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === "" || v == null ? null : parseValorBR(v)))
    .refine((v) => v === null || (v >= 0 && v <= 9_999_999), {
      message: "Taxa inválida.",
    }),
  custoFrete: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === "" || v == null ? null : parseValorBR(v)))
    .refine((v) => v === null || (v >= 0 && v <= 9_999_999), {
      message: "Custo de frete inválido.",
    }),
});
