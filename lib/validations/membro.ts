import { z } from "zod";

// Campo numérico opcional vindo de <input type="number">: "" → null.
const numeroOpcional = (max: number, msg: string) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).trim().replace(",", ".");
      return s === "" ? null : Number(s);
    })
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= max), {
      message: msg,
    });

export const membroSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do membro."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("E-mail inválido.")
    .describe("Vira o login do painel"),
  role: z.enum(["EDITOR", "ADMIN", "SUPER_ADMIN"], {
    message: "Escolha o papel.",
  }),
  limiteDescontoPercent: numeroOpcional(100, "Use um valor entre 0 e 100."),
  podeCancelarPedido: z.coerce.boolean().default(false),
  podeEstornar: z.coerce.boolean().default(false),
  limiteValorFinanceiro: numeroOpcional(
    9_999_999,
    "Valor inválido.",
  ),
});

export type MembroInput = z.output<typeof membroSchema>;
