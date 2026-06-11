import { z } from "zod";

export const categorySchema = z.object({
  nome: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(60, "Nome muito longo (máx 60)"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífen"),
  ordem: z.coerce
    .number()
    .int("Deve ser número inteiro")
    .min(0, "Ordem não pode ser negativa"),
});

export type CategoryInput = z.infer<typeof categorySchema>;
