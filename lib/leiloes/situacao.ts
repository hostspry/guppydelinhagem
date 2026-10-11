import type { OrderStatus } from "@/lib/generated/prisma/enums";

/**
 * Situação da cobrança de um arrematante, como a loja e o cliente enxergam.
 *
 * Módulo PURO (sem Prisma): a página do cliente e o painel usam a mesma régua.
 * A cobrança é um Order de origem LEILAO; o que muda em relação a um pedido
 * comum é o passo do frete, que o próprio arrematante escolhe antes de pagar.
 */
export type SituacaoArremate =
  | "ESCOLHER_ENTREGA" // cobrança gerada, o cliente ainda não escolheu o frete
  | "AGUARDANDO_PAGAMENTO" // frete escolhido, falta pagar
  | "PAGA"
  | "VENCIDA"
  | "CANCELADA";

export function situacaoDoArremate(o: {
  status: OrderStatus;
  expiraEm: Date | null;
  entregaEscolhidaEm: Date | null;
}): SituacaoArremate {
  if (o.status === "PAGO" || o.status === "ENVIADO" || o.status === "ENTREGUE") {
    return "PAGA";
  }
  if (o.status === "CANCELADO") return "CANCELADA";
  if (o.expiraEm && o.expiraEm.getTime() < Date.now()) return "VENCIDA";
  return o.entregaEscolhidaEm ? "AGUARDANDO_PAGAMENTO" : "ESCOLHER_ENTREGA";
}

/** Ainda dá para escolher frete e pagar. */
export function arremateAberto(s: SituacaoArremate): boolean {
  return s === "ESCOLHER_ENTREGA" || s === "AGUARDANDO_PAGAMENTO";
}

export const SITUACAO_ARREMATE: Record<
  SituacaoArremate,
  { label: string; badge: string }
> = {
  // O frete não é pendência: o cliente vê pelo CEP e escolhe na mesma tela em
  // que paga. Para quem olha o painel, é só uma cobrança esperando pagamento.
  ESCOLHER_ENTREGA: {
    label: "Aguardando pagamento",
    badge: "bg-blue-100 text-blue-700",
  },
  AGUARDANDO_PAGAMENTO: {
    label: "Aguardando pagamento",
    badge: "bg-blue-100 text-blue-700",
  },
  PAGA: { label: "Paga", badge: "bg-green-100 text-green-700" },
  VENCIDA: { label: "Vencida", badge: "bg-gray-200 text-gray-700" },
  CANCELADA: { label: "Cancelada", badge: "bg-gray-100 text-gray-500" },
};

/** "Lote 3 · Trio Red Silverado Albino" — é o nome que vai no item do pedido. */
export function rotuloLote(l: { numero: string | null; nome: string }): string {
  const n = (l.numero ?? "").trim();
  return n ? `Lote ${n} · ${l.nome}` : l.nome;
}

const FUSO = "America/Sao_Paulo";

/** Data do leilão por extenso curto: "09/10/2026". */
export function dataLeilaoBR(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO });
}

/** "AAAA-MM-DD" no fuso de Brasília (valor do <input type="date">). */
export function diaISO(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: FUSO });
}

/**
 * Meio-dia de Brasília do dia informado ("AAAA-MM-DD"). Guardar o meio-dia, e
 * não a meia-noite, evita que o fuso empurre a data para o dia anterior.
 */
export function meioDiaBRT(dia: string): Date {
  return new Date(`${dia}T12:00:00-03:00`);
}
