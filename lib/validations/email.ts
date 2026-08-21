import { z } from "zod";

/**
 * Conta SMTP cadastrada no admin.
 *
 * A senha é opcional na EDIÇÃO: quando já existe uma salva e o campo vem vazio,
 * a action mantém a anterior — assim o dono ajusta porta ou remetente sem
 * precisar digitar a senha de novo (e sem a tela nunca devolver a senha).
 */
export const contaEmailSchema = z.object({
  ativo: z.coerce.boolean().default(false),
  host: z
    .string()
    .trim()
    .min(3, "Informe o servidor de saída (ex.: elion.serversbr.com)")
    .max(200),
  porta: z.coerce
    .number()
    .int("Porta inválida")
    .min(1, "Porta inválida")
    .max(65535, "Porta inválida"),
  seguranca: z.enum(["STARTTLS", "SSL", "NENHUMA"]),
  usuario: z.string().trim().min(1, "Informe o usuário (normalmente o e-mail completo)").max(200),
  senha: z.string().max(200).optional().or(z.literal("")),
  remetenteNome: z.string().trim().min(2, "Informe o nome que aparece no envio").max(80),
  remetenteEmail: z.string().trim().email("E-mail do remetente inválido"),
  responderPara: z
    .union([z.string().trim().email("E-mail de resposta inválido"), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
});

export type ContaEmailInput = z.output<typeof contaEmailSchema>;

/** Destinatário do e-mail de teste. */
export const emailTesteSchema = z.object({
  para: z.string().trim().email("Informe um e-mail válido para o teste"),
});
