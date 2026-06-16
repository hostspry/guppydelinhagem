import type { OrderStatus } from "@/lib/generated/prisma/client";

// Rótulo (PT) + classes de badge por status. Compartilhado entre lista, detalhe
// e o controle de status (server e client).
export const STATUS_PEDIDO: Record<
  OrderStatus,
  { label: string; badge: string }
> = {
  RASCUNHO: { label: "Rascunho", badge: "bg-gray-100 text-gray-700" },
  AGUARDANDO_PAGAMENTO: {
    label: "Aguardando pagamento",
    badge: "bg-amber-100 text-amber-800",
  },
  PAGO: { label: "Pago", badge: "bg-green-100 text-green-800" },
  ENVIADO: { label: "Enviado", badge: "bg-blue-100 text-blue-800" },
  ENTREGUE: { label: "Entregue", badge: "bg-emerald-100 text-emerald-800" },
  CANCELADO: { label: "Cancelado", badge: "bg-red-100 text-red-800" },
};

// Máquina de estados (§4 do spec). Fonte única — usada pela action (validação) e
// pelo StatusPedidoControl (só oferece as próximas transições válidas).
export const TRANSICOES_PEDIDO: Record<OrderStatus, OrderStatus[]> = {
  RASCUNHO: ["AGUARDANDO_PAGAMENTO"],
  AGUARDANDO_PAGAMENTO: ["PAGO", "CANCELADO"],
  PAGO: ["ENVIADO", "CANCELADO"],
  ENVIADO: ["ENTREGUE"],
  ENTREGUE: [],
  CANCELADO: [],
};

// Itens só podem ser editados nesses status (a partir de PAGO, trava §4).
export const STATUS_EDITAVEIS: OrderStatus[] = [
  "RASCUNHO",
  "AGUARDANDO_PAGAMENTO",
];

export function podeEditarItens(status: OrderStatus): boolean {
  return STATUS_EDITAVEIS.includes(status);
}
