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
  metaTitle: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),
  metaDescription: z
    .string()
    .max(160, "Máx 160 caracteres")
    .optional()
    .or(z.literal("")),
  keywords: z
    .array(z.string().trim().min(1).max(60))
    .max(20, "Máximo de 20 palavras-chave")
    .default([]),

  // ── Atributos específicos (manuais) ──
  // sexoComposicao é lista fixa; os demais são flexíveis (sugestões + livre).
  sexoComposicao: z
    .enum(["MACHO", "FEMEA", "CASAL", "TRIO", "LOTE"])
    .optional()
    .or(z.literal("")),
  padraoCor: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),
  cauda: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),
  caracteristica: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),
  origem: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),

  // ── Atributos gerais (IA, revisáveis) ──
  temperatura: z.string().max(40, "Máx 40 caracteres").optional().or(z.literal("")),
  ph: z.string().max(40, "Máx 40 caracteres").optional().or(z.literal("")),
  alimentacao: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),
  expectativaVida: z.string().max(40, "Máx 40 caracteres").optional().or(z.literal("")),
  porte: z.string().max(40, "Máx 40 caracteres").optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productSchema>;

// Opções/sugestões dos atributos — usadas no form admin.
export const SEXO_COMPOSICAO_OPCOES = [
  { value: "MACHO", label: "Macho" },
  { value: "FEMEA", label: "Fêmea" },
  { value: "CASAL", label: "Casal" },
  { value: "TRIO", label: "Trio" },
  { value: "LOTE", label: "Lote" },
] as const;

export const PADRAO_COR_SUGESTOES = ["koi", "super koi", "full red", "tuxedo"];
export const CAUDA_SUGESTOES = ["halfmoon", "delta", "super delta", "roundtail"];
export const CARACTERISTICA_SUGESTOES = ["dumbo"];
export const ORIGEM_SUGESTOES = ["nacional", "americano", "asiático", "europeu"];

// ── Vídeos (relação filha gerenciada como array no form) ───────────────────
// Validado na action a partir do JSON serializado pelo ProductForm.
export const videoDraftSchema = z.object({
  id: z.string().optional(), // presente em vídeos já existentes (edição)
  platform: z.enum(["YOUTUBE", "INSTAGRAM", "TIKTOK"]),
  videoId: z.string().nullable().optional(),
  originalUrl: z.string().url("URL inválida"),
  titulo: z.string().max(200).optional().or(z.literal("")),
  thumbnailUrl: z.string().url("Thumbnail inválida").optional().or(z.literal("")),
  principal: z.boolean().optional(),
});

export const videosSchema = z.array(videoDraftSchema);

export type VideoDraft = z.infer<typeof videoDraftSchema>;
