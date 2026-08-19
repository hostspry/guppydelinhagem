import { z } from "zod";

// Aceita "1.234,56", "1234.56" e "1234" — o admin digita como quiser.
const valorBR = z
  .string()
  .trim()
  .min(1, "Informe o valor")
  .transform((v) => v.replace(/\./g, "").replace(",", "."))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Valor inválido")
  .transform((v) => Number(v));

const inteiro = (def: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? def : Number(v)));

/**
 * Cobrança avulsa criada no painel.
 *
 * O cliente pode ser um já cadastrado (`clienteId`) ou um novo digitado na hora
 * (`clienteNome` + contato). O Order exige cliente, e o gateway exige um e-mail
 * de pagador — por isso o e-mail é obrigatório quando o cliente é novo.
 */
export const cobrancaSchema = z
  .object({
    clienteId: z.string().optional().or(z.literal("")),
    clienteNome: z.string().optional().or(z.literal("")),
    clienteEmail: z
      .string()
      .email("E-mail inválido")
      .optional()
      .or(z.literal("")),
    clienteTelefone: z.string().optional().or(z.literal("")),
    // CPF/CNPJ do pagador. Opcional no formulário (nem sempre a gente tem na
    // hora), mas é o sinal que mais pesa no antifraude do Mercado Pago: sem ele
    // o cartão cai em cc_rejected_high_risk mesmo com o cartão bom.
    clienteCpf: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => {
          const d = (v ?? "").replace(/\D/g, "");
          return d === "" || d.length === 11 || d.length === 14;
        },
        { message: "CPF/CNPJ inválido" },
      ),

    descricao: z
      .string()
      .trim()
      .min(3, "Descreva o que está sendo cobrado")
      .max(120, "Descrição muito longa"),
    valor: valorBR.refine((n) => n >= 1, "O valor mínimo é R$ 1,00"),
    validadeDias: inteiro(7).pipe(
      z
        .number()
        .int()
        .min(1, "Mínimo 1 dia")
        .max(90, "Máximo 90 dias"),
    ),
    maxParcelas: inteiro(12).pipe(
      z.number().int().min(1, "Mínimo 1x").max(12, "Máximo 12x"),
    ),
    observacoes: z.string().max(500).optional().or(z.literal("")),
  })
  .refine((d) => !!d.clienteId || (d.clienteNome ?? "").trim().length >= 2, {
    message: "Escolha um cliente ou digite o nome",
    path: ["clienteNome"],
  })
  // Sem e-mail o Mercado Pago cria o pagamento com pagador anônimo e o antifraude
  // recusa o cartão. Em cliente novo, exigimos aqui mesmo.
  .refine((d) => !!d.clienteId || (d.clienteEmail ?? "").trim() !== "", {
    message: "Informe o e-mail — o Mercado Pago precisa dele para aprovar o cartão",
    path: ["clienteEmail"],
  });

export type CobrancaInput = z.infer<typeof cobrancaSchema>;
