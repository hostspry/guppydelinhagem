import { z } from "zod";
import { parseValorBR } from "./financeiro";

/** Aceita "1.135,00", "1135" ou número; zero vale (item que foi de brinde). */
const valorBR = (minimo: number) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => parseValorBR(v))
    .refine((v): v is number => v !== null && v >= minimo, {
      message: minimo > 0 ? "Informe um valor maior que zero." : "Valor inválido.",
    })
    .refine((v) => (v ?? 0) <= 9_999_999, { message: "Valor alto demais." });

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

export const FORMAS_RECEBIMENTO = ["PIX", "DINHEIRO", "CARTAO", "BOLETO", "OUTRO"] as const;

/**
 * Cada linha é o que foi combinado com o distribuidor: nome livre, quantidade
 * e o valor da LINHA inteira (é assim que a lista chega no WhatsApp: "150 mix
 * - 450,00"). O preço unitário sai da divisão.
 */
export const itemDistribuidorSchema = z.object({
  nome: z.string().trim().min(1, "Dê um nome ao item.").max(200),
  quantidade: z.coerce.number().int().min(1, "Mínimo 1.").max(100_000),
  valor: valorBR(0),
});

export const pedidoDistribuidorSchema = z
  .object({
    clienteId: z.string().optional().nullable(),
    nome: z.string().trim().min(2, "Informe o nome do distribuidor.").max(120),
    telefone: z.string().trim().max(30).optional().default(""),
    data: dataISO,
    itens: z.array(itemDistribuidorSchema).min(1, "Adicione ao menos um item."),
    /** Total combinado. Vazio = soma dos itens. */
    total: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v === undefined || v === "" ? null : parseValorBR(v))),
    valorPago: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => (v === undefined || v === "" ? 0 : (parseValorBR(v) ?? -1))),
    formaPagamento: z.enum(FORMAS_RECEBIMENTO).default("PIX"),
    vencimentoSaldo: z
      .union([dataISO, z.literal(""), z.null(), z.undefined()])
      .transform((v) => (v ? v : null)),
    observacoes: z.string().trim().max(2000).optional().default(""),
  })
  .refine((d) => d.valorPago >= 0, {
    message: "Valor pago inválido.",
    path: ["valorPago"],
  })
  .refine((d) => d.total === null || d.total > 0, {
    message: "Total inválido.",
    path: ["total"],
  });

export type PedidoDistribuidorInput = z.infer<typeof pedidoDistribuidorSchema>;

export const recebimentoDistribuidorSchema = z.object({
  orderId: z.string().min(1),
  valor: valorBR(0.01),
  data: dataISO,
  formaPagamento: z.enum(FORMAS_RECEBIMENTO).default("PIX"),
});
