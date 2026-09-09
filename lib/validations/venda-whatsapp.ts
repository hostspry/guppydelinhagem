import { z } from "zod";

const digitos = (s: string) => s.replace(/\D/g, "");

/** Item da venda: do catálogo (produtoId) ou digitado à mão (avulso). */
const itemSchema = z.object({
  produtoId: z.string().optional().nullable(),
  composicao: z
    .enum(["TRIO", "CASAL", "MACHO", "FEMEA", "LOTE"])
    .optional()
    .nullable(),
  /** Só usado no avulso; no do catálogo o nome vem do banco. */
  nomeProduto: z.string().trim().max(160).optional().default(""),
  precoUnitario: z.coerce.number().min(0, "Preço não pode ser negativo"),
  quantidade: z.coerce.number().int().min(1, "Mínimo 1"),
});

export const vendaWhatsappSchema = z
  .object({
    // ── Cliente ──
    clienteId: z.string().optional().nullable(), // quando o operador confirmou um existente
    nome: z.string().trim().min(3, "Informe o nome do cliente"),
    cpfCnpj: z
      .string()
      .transform(digitos)
      .refine((v) => v === "" || v.length === 11 || v.length === 14, "CPF/CNPJ inválido")
      .optional()
      .default(""),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido")
      .optional()
      .default(""),
    telefone: z
      .string()
      .transform(digitos)
      .refine((v) => v === "" || v.length === 10 || v.length === 11, "Telefone inválido")
      .optional()
      .default(""),
    cep: z
      .string()
      .transform(digitos)
      .refine((v) => v === "" || v.length === 8, "CEP precisa ter 8 dígitos")
      .optional()
      .default(""),
    logradouro: z.string().trim().max(160).optional().default(""),
    numero: z.string().trim().max(20).optional().default(""),
    complemento: z.string().trim().max(80).optional().default(""),
    bairro: z.string().trim().max(80).optional().default(""),
    cidade: z.string().trim().max(80).optional().default(""),
    uf: z.string().trim().toUpperCase().max(2).optional().default(""),

    // ── Venda ──
    itens: z.array(itemSchema).min(1, "Inclua ao menos um item"),
    frete: z.coerce.number().min(0).default(0),
    desconto: z.coerce.number().min(0).default(0),
    observacoes: z.string().trim().max(500).optional().default(""),
    /** Cliente já pagou: o pedido nasce PAGO e cai no caixa para conferência. */
    jaPago: z.coerce.boolean().default(false),
    formaPagamento: z
      .enum(["PIX", "CARTAO", "DINHEIRO", "BOLETO", "OUTRO"])
      .optional()
      .nullable(),
  })
  .superRefine((d, ctx) => {
    // Endereço é obrigatório para despachar. Sem CEP não há etiqueta nem frete.
    if (!d.cep) {
      ctx.addIssue({
        code: "custom",
        path: ["cep"],
        message: "Sem CEP não dá para gerar etiqueta nem calcular frete.",
      });
    }
    for (const [i, it] of d.itens.entries()) {
      if (!it.produtoId && !it.nomeProduto.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["itens", i, "nomeProduto"],
          message: "Escolha um produto ou dê um nome ao item avulso.",
        });
      }
    }
  });

export type VendaWhatsappInput = z.output<typeof vendaWhatsappSchema>;
