import { z } from "zod";
import { refineEntrega } from "@/lib/validations/checkout";

const digits = (s: string) => s.replace(/\D/g, "");

// Aceita "1.234,56", "1234.56" e "1234" — o admin digita como quiser.
const valorBR = z
  .string()
  .trim()
  .min(1, "Informe o valor")
  .transform((v) => (v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Valor inválido")
  .transform((v) => Number(v));

/**
 * Lote do leilão = os 2 casais do vídeo. Xeque-Mate também leva 2 casais e o
 * Mestre Criador leva 4 (8 peixes): esses o admin ajusta no lote.
 */
export const PEIXES_POR_LOTE = 4;

/** "Pagamento em até 48h após o leilão" (regra do grupo). */
export const PRAZO_PADRAO_DIAS = 2;

const inteiro = (def: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? def : Number(v)));

/** Leilão criado/editado no painel. */
export const leilaoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Dê um nome ao leilão")
    .max(120, "Nome muito longo"),
  dataLeilao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do leilão"),
  prazoPagamentoDias: inteiro(PRAZO_PADRAO_DIAS).pipe(
    z.number().int().min(1, "Mínimo 1 dia").max(30, "Máximo 30 dias"),
  ),
  maxParcelas: inteiro(12).pipe(
    z.number().int().min(1, "Mínimo 1x").max(12, "Máximo 12x"),
  ),
  observacoes: z.string().max(500).optional().or(z.literal("")),
});

/**
 * Lote arrematado. O arrematante é um cliente já cadastrado (`clienteId`) ou um
 * novo, pelo nome e WhatsApp (o número é o que liga o lote à conta dele no site).
 */
export const loteSchema = z
  .object({
    numero: z.string().trim().max(12, "Número muito longo").optional().or(z.literal("")),
    nome: z
      .string()
      .trim()
      .min(2, "Informe o nome do lote")
      .max(120, "Nome muito longo"),
    qtdPeixes: inteiro(PEIXES_POR_LOTE).pipe(
      z.number().int().min(1, "Mínimo 1 peixe").max(50, "Máximo 50 peixes"),
    ),
    valor: valorBR.refine((n) => n >= 1, "O valor mínimo é R$ 1,00"),
    clienteId: z.string().optional().or(z.literal("")),
    clienteNome: z.string().trim().optional().or(z.literal("")),
    clienteTelefone: z.string().trim().optional().or(z.literal("")),
  })
  .refine((d) => !!d.clienteId || (d.clienteNome ?? "").length >= 2, {
    message: "Escolha um cliente ou digite o nome de quem arrematou",
    path: ["clienteNome"],
  });

/**
 * Entrega escolhida pelo arrematante na página da cobrança. Mesmas regras do
 * checkout (endereço só é exigido no envio): o pagador precisa de e-mail e CPF
 * para o Pix e para o antifraude do cartão.
 */
export const entregaArremateSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe seu nome completo"),
    telefone: z
      .string()
      .transform(digits)
      .pipe(z.string().min(10, "Informe um WhatsApp válido")),
    email: z.string().trim().email("E-mail inválido"),
    cpfCnpj: z
      .string()
      .transform(digits)
      .pipe(
        z
          .string()
          .refine((d) => d.length === 11 || d.length === 14, "Informe um CPF/CNPJ válido"),
      ),
    tipoEntrega: z.enum(["ENVIO", "RETIRADA"]).default("ENVIO"),
    modalidadeFrete: z.enum(["TERRESTRE", "AEREO"]).default("TERRESTRE"),
    cep: z.string().transform(digits).optional().default(""),
    logradouro: z.string().trim().optional().default(""),
    numero: z.string().trim().optional().default(""),
    complemento: z.string().trim().optional().default(""),
    bairro: z.string().trim().optional().default(""),
    cidade: z.string().trim().optional().default(""),
    uf: z.string().trim().optional().default(""),
  })
  .superRefine(refineEntrega);

export type EntregaArremateForm = z.input<typeof entregaArremateSchema>;
