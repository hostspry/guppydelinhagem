import { z } from "zod";
import { cadastroPublicoSchema } from "./cadastro-publico";

/**
 * Cadastro de conta pelo site: os mesmos dados de quem compra um peixe (nome,
 * CPF, WhatsApp, endereço) mais e-mail e senha. O e-mail aqui é obrigatório:
 * é o caminho do "esqueci a senha".
 */
export const cadastroContaSchema = cadastroPublicoSchema.extend({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Informe seu e-mail")
    .max(160)
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Confira o e-mail"),
  senha: z
    .string()
    .min(6, "A senha precisa ter pelo menos 6 letras ou números")
    .max(72, "Senha muito longa"),
});

export type CadastroContaInput = z.output<typeof cadastroContaSchema>;
