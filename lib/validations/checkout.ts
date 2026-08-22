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

// Base SEM o refine condicional — preserva `.shape`/`.omit` para o client e para
// os pontos que só precisam dos `itens`. O endereço é OPCIONAL aqui: a exigência
// (só no ENVIO) entra no superRefine de `checkoutSchema`/`camposSchema`.
export const checkoutBaseSchema = z.object({
  // Identificação (guest) — email + CPF são exigidos pelo pagador do Pix. SEMPRE
  // obrigatórios (inclusive na retirada — cadastro + antifraude).
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
  // Tipo de entrega: ENVIO (despacha) ou RETIRADA (cliente busca, frete 0).
  tipoEntrega: z.enum(["ENVIO", "RETIRADA"]).default("ENVIO"),
  // Entrega — opcional no base; exigido condicionalmente (ENVIO) no refine.
  cep: z.string().transform(digits).optional().default(""),
  logradouro: z.string().trim().optional().default(""),
  numero: z.string().trim().optional().default(""),
  complemento: z.string().trim().optional().default(""),
  bairro: z.string().trim().optional().default(""),
  cidade: z.string().trim().optional().default(""),
  uf: z.string().trim().optional().default(""),
  // Frete escolhido (o VALOR é re-cotado no servidor; só a transportadora importa)
  transportadora: z.enum(Transportadora),
  // Modalidade escolhida pelo cliente: terrestre (Jadlog) ou aéreo (Gollog). O
  // valor é sempre recalculado no servidor conforme a modalidade.
  modalidadeFrete: z.enum(["TERRESTRE", "AEREO"]).default("TERRESTRE"),
  // Semana que o cliente prefere receber (segunda-feira, "AAAA-MM-DD"). Vazio =
  // "assim que estiver pronto". O servidor confere se está na janela oferecida.
  semanaEnvio: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
    .optional()
    .default(""),
  // Código de cupom aplicado no carrinho (opcional). O desconto é SEMPRE revalidado
  // e recalculado no servidor — o valor do client é ignorado.
  cupomCodigo: z.string().trim().optional().default(""),
  itens: z.array(checkoutItemSchema).min(1, "Seu carrinho está vazio"),
});

// Endereço só é exigido no ENVIO. Na RETIRADA o cliente busca presencialmente —
// dispensa CEP/endereço (mantém nome/email/telefone/CPF, validados no base).
export function refineEntrega(
  data: { tipoEntrega?: "ENVIO" | "RETIRADA" } & Record<string, unknown>,
  ctx: z.RefinementCtx,
) {
  if ((data.tipoEntrega ?? "ENVIO") !== "ENVIO") return;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  if (str(data.cep).length !== 8) {
    ctx.addIssue({ code: "custom", path: ["cep"], message: "CEP inválido" });
  }
  const obrig: [string, string][] = [
    ["logradouro", "Informe o endereço"],
    ["numero", "Informe o número"],
    ["bairro", "Informe o bairro"],
    ["cidade", "Informe a cidade"],
  ];
  for (const [campo, msg] of obrig) {
    if (!str(data[campo]).trim()) {
      ctx.addIssue({ code: "custom", path: [campo], message: msg });
    }
  }
  if (str(data.uf).trim().length !== 2) {
    ctx.addIssue({ code: "custom", path: ["uf"], message: "UF deve ter 2 letras" });
  }
}

export const checkoutSchema = checkoutBaseSchema.superRefine(refineEntrega);

// Output (pós-transform: telefone/cpf/cep só dígitos, complemento default "").
export type CheckoutInput = z.infer<typeof checkoutSchema>;
// Input cru (o que o CheckoutClient monta e envia — strings formatadas).
export type CheckoutFormInput = z.input<typeof checkoutSchema>;
export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;
