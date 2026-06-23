import { z } from "zod";
// Enums do arquivo puro (/enums) — este schema é usado também pelo CupomForm
// (Client Component); importar de /client arrastaria o adapter pg pro bundle.
import {
  TipoValorCupom,
  EscopoCupom,
  ModoAplicacaoCupom,
} from "@/lib/generated/prisma/enums";

// "" / null / undefined → undefined (campo opcional vazio). Demais valores seguem
// para o schema interno (coerce de número/data).
const vazioParaUndefined = (schema: z.ZodTypeAny) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    schema,
  );

// Data opcional vinda de <input type="date"> ("YYYY-MM-DD") ou vazia. Mantida como
// string ISO no schema (comparável lexicograficamente); a action converte p/ Date.
const dataOpcional = vazioParaUndefined(
  z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Data inválida"),
).optional() as z.ZodType<string | undefined>;

export const cupomSchema = z
  .object({
    codigo: z
      .string()
      .transform((s) => s.trim().toUpperCase())
      .pipe(
        z
          .string()
          .min(3, "O código deve ter ao menos 3 caracteres")
          .regex(
            /^[A-Z0-9]+$/,
            "Use apenas letras e números, sem espaços ou acentos",
          ),
      ),
    descricao: z.string().trim().optional().or(z.literal("")),
    tipoValor: z.enum(TipoValorCupom),
    valor: z.coerce.number().positive("Informe um valor maior que zero"),
    escopo: z.enum(EscopoCupom),
    modoAplicacao: z.enum(ModoAplicacaoCupom),
    ativo: z.boolean().default(true),
    validoDe: dataOpcional,
    validoAte: dataOpcional,
    limiteUsos: vazioParaUndefined(
      z.coerce.number().int().min(1, "O limite deve ser ao menos 1"),
    ).optional() as z.ZodType<number | undefined>,
    encerraAoEsgotarEstoque: z.boolean().default(false),
    pedidoMinimo: vazioParaUndefined(
      z.coerce.number().min(0, "O pedido mínimo não pode ser negativo"),
    ).optional() as z.ZodType<number | undefined>,
    categoriaIds: z.array(z.string()).default([]),
    produtoIds: z.array(z.string()).default([]),
  })
  // Percentual nunca passa de 100.
  .refine((d) => d.tipoValor !== "PERCENTUAL" || d.valor <= 100, {
    path: ["valor"],
    message: "O percentual não pode passar de 100%",
  })
  // Janela de datas coerente.
  .refine(
    (d) => !d.validoDe || !d.validoAte || d.validoAte >= d.validoDe,
    {
      path: ["validoAte"],
      message: "A data final deve ser igual ou posterior à inicial",
    },
  )
  // "Encerra ao esgotar estoque" só faz sentido com escopo de categoria/produto.
  .refine((d) => !d.encerraAoEsgotarEstoque || d.escopo !== "TODOS", {
    path: ["encerraAoEsgotarEstoque"],
    message:
      "Esta opção só vale para cupons com escopo de categorias ou produtos",
  })
  // Escopo CATEGORIAS exige ao menos uma categoria.
  .refine((d) => d.escopo !== "CATEGORIAS" || d.categoriaIds.length > 0, {
    path: ["categoriaIds"],
    message: "Selecione ao menos uma categoria",
  })
  // Escopo PRODUTOS exige ao menos um produto.
  .refine((d) => d.escopo !== "PRODUTOS" || d.produtoIds.length > 0, {
    path: ["produtoIds"],
    message: "Selecione ao menos um produto",
  });

export type CupomInput = z.infer<typeof cupomSchema>;
export type CupomFormInput = z.input<typeof cupomSchema>;
