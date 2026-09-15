import { z } from "zod";
import { cadastroPublicoSchema } from "./cadastro-publico";
import { cpfValido } from "@/lib/whatsapp-cliente";

const digitos = (s: string) => s.replace(/\D/g, "");

/**
 * O que o cliente confirma no link do envio aéreo: os mesmos dados do cadastro
 * público (vão na minuta), o aeroporto e, se não for ele, quem vai retirar.
 */
export const confirmacaoAereoSchema = cadastroPublicoSchema
  .extend({
    aeroporto: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Escolha onde vai retirar"),
    outraPessoaRetira: z.boolean().default(false),
    recebedorNome: z.string().trim().max(120).optional().default(""),
    recebedorCpf: z.string().transform(digitos).optional().default(""),
    recebedorTelefone: z.string().transform(digitos).optional().default(""),
  })
  .superRefine((d, ctx) => {
    if (!d.outraPessoaRetira) return;
    if (d.recebedorNome.split(/\s+/).filter(Boolean).length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["recebedorNome"],
        message: "Nome completo de quem vai retirar",
      });
    }
    if (!cpfValido(d.recebedorCpf)) {
      ctx.addIssue({
        code: "custom",
        path: ["recebedorCpf"],
        message: "CPF de quem vai retirar não confere",
      });
    }
    if (d.recebedorTelefone.length !== 10 && d.recebedorTelefone.length !== 11) {
      ctx.addIssue({
        code: "custom",
        path: ["recebedorTelefone"],
        message: "Telefone com DDD de quem vai retirar",
      });
    }
  });

export type ConfirmacaoAereoInput = z.output<typeof confirmacaoAereoSchema>;
