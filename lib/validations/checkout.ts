import { z } from "zod";
// Enums do arquivo puro (/enums) — este schema é usado também pelo CheckoutClient
// (Client Component); importar de /client arrastaria o adapter pg pro bundle.
import { TipoComposicao, Transportadora } from "@/lib/generated/prisma/enums";

const digits = (s: string) => (s ?? "").replace(/\D/g, "");

// Item enviado pelo client = só referência + quantidade. PREÇO NÃO entra: é
// recalculado no servidor a partir da variante (anti-fraude). A composição
// resolve a variante (productId + composicao).
export const checkoutItemSchema = z.object({
  produtoId: z.string().min(1),
  composicao: z.enum(TipoComposicao).nullable(),
  quantidade: z.coerce.number().int().min(1).max(999),
});

export const checkoutSchema = z.object({
  // Identificação (guest) — email + CPF são exigidos pelo pagador do Pix.
  nome: z.string().trim().min(2, "Informe seu nome completo"),
  telefone: z
    .string()
    .transform(digits)
    .pipe(z.string().min(10, "Informe um telefone/WhatsApp válido")),
  email: z.string().trim().email("E-mail inválido"),
  cpfCnpj: z
    .string()
    .transform(digits)
    .pipe(z.string().min(11, "Informe um CPF/CNPJ válido").max(14)),
  // Entrega
  cep: z
    .string()
    .transform(digits)
    .pipe(z.string().length(8, "CEP inválido")),
  logradouro: z.string().trim().min(1, "Informe o endereço"),
  numero: z.string().trim().min(1, "Informe o número"),
  complemento: z.string().trim().optional().default(""),
  bairro: z.string().trim().min(1, "Informe o bairro"),
  cidade: z.string().trim().min(1, "Informe a cidade"),
  uf: z.string().trim().length(2, "UF deve ter 2 letras"),
  // Frete escolhido (o VALOR é re-cotado no servidor; só a transportadora importa)
  transportadora: z.enum(Transportadora),
  // Modalidade escolhida pelo cliente: terrestre (Jadlog) ou aéreo (Gollog). O
  // valor é sempre recalculado no servidor conforme a modalidade.
  modalidadeFrete: z.enum(["TERRESTRE", "AEREO"]).default("TERRESTRE"),
  itens: z.array(checkoutItemSchema).min(1, "Seu carrinho está vazio"),
});

// Output (pós-transform: telefone/cpf/cep só dígitos, complemento default "").
export type CheckoutInput = z.infer<typeof checkoutSchema>;
// Input cru (o que o CheckoutClient monta e envia — strings formatadas).
export type CheckoutFormInput = z.input<typeof checkoutSchema>;
export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;
