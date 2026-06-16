import { z } from "zod";
// Enums do arquivo puro (const objects, sem o runtime do PrismaClient) — este
// schema é importado pelo PedidoForm (client component); importar de /client
// arrastaria o adapter pg + built-ins Node para o bundle do cliente.
import { FormaPagamento, Transportadora } from "@/lib/generated/prisma/enums";

// "" / null / undefined → undefined (para selects opcionais de enum).
const emptyToUndef = (v: unknown) =>
  v === "" || v === null ? undefined : v;

export const itemPedidoSchema = z.object({
  // null = item avulso; string = referência ao catálogo.
  produtoId: z.preprocess(
    (v) => (v ? v : null),
    z.string().nullable(),
  ),
  nomeProduto: z.string().min(1, "Nome do item obrigatório"),
  precoUnitario: z.coerce.number().positive("Preço deve ser maior que zero"),
  quantidade: z.coerce.number().int().min(1, "Quantidade mínima é 1"),
});

export const pedidoSchema = z.object({
  clienteId: z.string().min(1, "Selecione um cliente"),
  itens: z.array(itemPedidoSchema).min(1, "Adicione ao menos um item"),
  frete: z.coerce.number().min(0, "Frete não pode ser negativo").default(0),
  desconto: z.coerce
    .number()
    .min(0, "Desconto não pode ser negativo")
    .default(0),
  formaPagamento: z.preprocess(
    emptyToUndef,
    z.enum(FormaPagamento).optional(),
  ),
  transportadora: z.preprocess(
    emptyToUndef,
    z.enum(Transportadora).optional(),
  ),
  observacoes: z.string().optional().or(z.literal("")),
});

export type PedidoInput = z.infer<typeof pedidoSchema>;
export type ItemPedidoInput = z.infer<typeof itemPedidoSchema>;

// Snapshot do destinatário gravado em Order.enderecoEntrega (Json). Preserva
// para onde o pedido foi mesmo que o cliente mude de endereço depois.
export const enderecoEntregaSchema = z.object({
  nome: z.string(),
  cpfCnpj: z.string().nullable(),
  telefone: z.string().nullable(),
  email: z.string().nullable(),
  cep: z.string().nullable(),
  logradouro: z.string().nullable(),
  numero: z.string().nullable(),
  complemento: z.string().nullable(),
  bairro: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
});

export type EnderecoEntrega = z.infer<typeof enderecoEntregaSchema>;
