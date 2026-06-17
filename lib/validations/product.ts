import { z } from "zod";
import { ProductType, TipoComposicao } from "@/lib/generated/prisma/enums";

// Checkbox vindo de FormData chega como "true"/"false"/"on" ou ausente.
// z.coerce.boolean() trataria "false" como `true` (string não-vazia é truthy),
// então convertemos explicitamente via preprocess.
const checkboxBool = z.preprocess(
  (v) => v === true || v === "true" || v === "on" || v === "1",
  z.boolean(),
);

// "" / null → undefined (campos numéricos opcionais: preço/estoque do Product,
// dormentes em PEIXE — as variantes mandam). Genérico p/ preservar o tipo de saída.
const numOpt = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema);

// ── Variante de composição (trio/casal/macho/fêmea/lote) ───────────────────
export const variantSchema = z.object({
  composicao: z.enum(TipoComposicao),
  preco: z.coerce.number().positive("Preço deve ser maior que zero"),
  qtdMachos: z.coerce.number().int().min(0, "Não pode ser negativo"),
  qtdFemeas: z.coerce.number().int().min(0, "Não pode ser negativo"),
  rotulo: z.string().max(80, "Máx 80 caracteres").optional().or(z.literal("")),
  padrao: z.boolean().default(false),
  ativo: z.boolean().default(true),
}).refine((v) => v.qtdMachos + v.qtdFemeas >= 1, {
  message: "A receita precisa de ao menos 1 peixe (macho ou fêmea).",
  path: ["qtdMachos"],
});
export type VariantInput = z.infer<typeof variantSchema>;

export const productSchema = z
  .object({
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
    // preço/estoque do Product: usados por NÃO-peixe; em PEIXE ficam dormentes
    // (a action espelha o trio). Por isso opcionais aqui — o superRefine cobra.
    preco: numOpt(z.coerce.number().positive("Preço deve ser maior que zero").optional()),
    descontoPix: numOpt(
      z.coerce.number().min(0, "Não pode ser negativo").max(100, "Máx 100%").optional(),
    ),
    parcelasMax: z.coerce.number().int().min(1).max(12).default(3),
    tipo: z.enum(ProductType),
    estoque: numOpt(
      z.coerce.number().int("Deve ser número inteiro").min(0, "Não pode ser negativo").optional(),
    ),
    // Pool de estoque (só PEIXE): o operador digita machos e fêmeas.
    estoqueMachos: numOpt(
      z.coerce.number().int("Deve ser número inteiro").min(0, "Não pode ser negativo").optional(),
    ),
    estoqueFemeas: numOpt(
      z.coerce.number().int("Deve ser número inteiro").min(0, "Não pode ser negativo").optional(),
    ),
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

    // ── Composições (só PEIXE) ──
    variantes: z.array(variantSchema).default([]),

    // ── Atributos específicos (manuais; composição saiu para variantes) ──
    padraoCor: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),
    cauda: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),
    caracteristica: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),
    origem: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),

    // ── Atributos gerais (IA, revisáveis) ──
    temperatura: z.string().max(40, "Máx 40 caracteres").optional().or(z.literal("")),
    ph: z.string().max(40, "Máx 40 caracteres").optional().or(z.literal("")),
    alimentacao: z.string().max(60, "Máx 60 caracteres").optional().or(z.literal("")),
    expectativaVida: z.string().max(40, "Máx 40 caracteres").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === "PEIXE") {
      const ativas = data.variantes.filter((v) => v.ativo);
      if (ativas.length < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["variantes"],
          message: "Peixe precisa de ao menos uma composição ativa.",
        });
      }
      if (ativas.filter((v) => v.padrao).length !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["variantes"],
          message: "Exatamente uma composição ativa deve ser a padrão (o trio).",
        });
      }
      const comps = ativas.map((v) => v.composicao);
      if (new Set(comps).size !== comps.length) {
        ctx.addIssue({
          code: "custom",
          path: ["variantes"],
          message: "Composição repetida.",
        });
      }
      // Pool de machos/fêmeas obrigatório para peixe.
      if (data.estoqueMachos == null) {
        ctx.addIssue({
          code: "custom",
          path: ["estoqueMachos"],
          message: "Informe o estoque de machos.",
        });
      }
      if (data.estoqueFemeas == null) {
        ctx.addIssue({
          code: "custom",
          path: ["estoqueFemeas"],
          message: "Informe o estoque de fêmeas.",
        });
      }
    } else {
      // Não-peixe: sem variantes; preço/estoque do produto obrigatórios.
      if (data.variantes.some((v) => v.ativo)) {
        ctx.addIssue({
          code: "custom",
          path: ["variantes"],
          message: "Só produtos do tipo Peixe têm composições.",
        });
      }
      if (data.preco == null) {
        ctx.addIssue({ code: "custom", path: ["preco"], message: "Informe o preço." });
      }
      if (data.estoque == null) {
        ctx.addIssue({ code: "custom", path: ["estoque"], message: "Informe o estoque." });
      }
    }
  });

export type ProductInput = z.infer<typeof productSchema>;

// ── Sugestões dos atributos (form admin) ──
export const PADRAO_COR_SUGESTOES = ["koi", "super koi", "full red", "tuxedo"];
export const CAUDA_SUGESTOES = ["halfmoon", "delta", "super delta", "roundtail"];
export const CARACTERISTICA_SUGESTOES = ["dumbo"];
export const ORIGEM_SUGESTOES = ["nacional", "americano", "asiático", "europeu"];

export const TIPO_PRODUTO_OPCOES = [
  { value: "PEIXE", label: "Peixe" },
  { value: "CORAL", label: "Coral" },
  { value: "PLANTA", label: "Planta" },
  { value: "ALIMENTO_VIVO", label: "Alimento vivo" },
  { value: "RACAO", label: "Ração" },
  { value: "ACESSORIO", label: "Acessório" },
  { value: "DIGITAL", label: "Digital" },
] as const;

// ── Vídeos (relação filha gerenciada como array no form) ───────────────────
export const videoDraftSchema = z.object({
  id: z.string().optional(),
  platform: z.enum(["YOUTUBE", "INSTAGRAM", "TIKTOK"]),
  videoId: z.string().nullable().optional(),
  originalUrl: z.string().url("URL inválida"),
  titulo: z.string().max(200).optional().or(z.literal("")),
  thumbnailUrl: z.string().url("Thumbnail inválida").optional().or(z.literal("")),
  principal: z.boolean().optional(),
});

export const videosSchema = z.array(videoDraftSchema);

export type VideoDraft = z.infer<typeof videoDraftSchema>;
