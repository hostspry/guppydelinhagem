import { z } from "zod";

// Checkbox vindo de FormData chega como "true"/"false"/"on" ou ausente.
// z.coerce.boolean() trataria "false" como `true` (string não-vazia é truthy),
// então convertemos explicitamente via preprocess.
const checkboxBool = z.preprocess(
  (v) => v === true || v === "true" || v === "on" || v === "1",
  z.boolean(),
);

export const productSchema = z.object({
  nome: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(120, "Nome muito longo (máx 120)"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífen"),
  descricao: z.string().min(10, "Descrição muito curta (mín 10 caracteres)"),
  descricaoCurta: z
    .string()
    .max(160, "Máx 160 caracteres")
    .optional()
    .or(z.literal("")),
  preco: z.coerce.number().positive("Preço deve ser maior que zero"),
  descontoPix: z.coerce
    .number()
    .min(0, "Não pode ser negativo")
    .max(100, "Máx 100%")
    .optional(),
  parcelasMax: z.coerce.number().int().min(1).max(12).default(3),
  tipo: z.enum(["FISICO", "DIGITAL"]),
  estoque: z.coerce
    .number()
    .int("Deve ser número inteiro")
    .min(0, "Não pode ser negativo"),
  categoryId: z.string().min(1, "Selecione uma categoria"),
  ativo: checkboxBool.default(true),
  destaque: checkboxBool.default(false),
});

export type ProductInput = z.infer<typeof productSchema>;
