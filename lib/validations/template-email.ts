import { z } from "zod";

/** Texto de um e-mail automático, editado no painel. */
export const templateEmailSchema = z.object({
  chave: z.string().trim().min(1),
  assunto: z.string().trim().min(3, "O assunto não pode ficar vazio").max(200),
  titulo: z.string().trim().min(2, "O título não pode ficar vazio").max(120),
  corpo: z.string().trim().min(10, "Escreva a mensagem").max(8000),
  ativo: z.coerce.boolean().default(true),
});

export type TemplateEmailInput = z.output<typeof templateEmailSchema>;
