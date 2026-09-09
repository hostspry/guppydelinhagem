import { z } from "zod";
import { cpfValido } from "@/lib/whatsapp-cliente";

const digitos = (s: string) => s.replace(/\D/g, "");

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE",
  "TO",
];

/**
 * Dados que o cliente preenche sozinho no link /cadastro, depois de fechar a
 * venda no WhatsApp.
 *
 * Aqui a régua é mais dura que a do cadastro pelo admin, e de propósito: o
 * operador enxerga a conversa inteira e conserta o que falta, o cliente sozinho
 * na tela não. Tudo que a etiqueta de envio precisa é obrigatório — endereço
 * pela metade só aparece na hora de despachar, quando o peixe já está separado.
 */
export const cadastroPublicoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(5, "Escreva seu nome completo")
    .max(120)
    .refine((v) => v.split(/\s+/).length >= 2, "Escreva nome e sobrenome"),
  cpfCnpj: z
    .string()
    .transform(digitos)
    .refine((v) => v.length === 11 || v.length === 14, "CPF ou CNPJ incompleto")
    .refine(
      (v) => v.length === 14 || cpfValido(v),
      "Esse CPF não confere. Confira os números.",
    ),
  telefone: z
    .string()
    .transform(digitos)
    .refine((v) => v.length === 10 || v.length === 11, "Telefone com DDD, por favor"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Confira o e-mail",
    )
    .optional()
    .default(""),
  cep: z
    .string()
    .transform(digitos)
    .refine((v) => v.length === 8, "CEP tem 8 números"),
  logradouro: z.string().trim().min(3, "Informe a rua").max(160),
  numero: z.string().trim().min(1, "Informe o número (ou S/N)").max(20),
  complemento: z.string().trim().max(80).optional().default(""),
  bairro: z.string().trim().min(2, "Informe o bairro").max(80),
  cidade: z.string().trim().min(2, "Informe a cidade").max(80),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => UFS.includes(v), "Escolha o estado"),
  /** Campo isca, invisível na tela: robô preenche tudo, gente não vê. */
  site: z.string().max(0).optional().default(""),
});

export type CadastroPublicoInput = z.output<typeof cadastroPublicoSchema>;
export const UFS_BR = UFS;
