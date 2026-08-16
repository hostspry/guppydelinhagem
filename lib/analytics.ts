// Camada central de eventos GA4 (e-commerce). Cada função só dispara se o `gtag`
// existir (guard) — sem GA configurado, é no-op silencioso. PRIVACIDADE: nenhum
// dado pessoal (nome/e-mail/CPF/telefone) nos payloads — só ids de produto,
// valores e número de pedido. Os valores vêm da fonte única (lib/precos); aqui
// não se recalcula nada.

import { EVENTOS, rastrear } from "@/lib/rastreio/cliente";

type GtagFn = (...args: unknown[]) => void;

function gtag(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: GtagFn };
  if (typeof w.gtag !== "function") return;
  w.gtag(...args);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
  item_category?: string;
};

function comQtd(i: AnalyticsItem): AnalyticsItem {
  return { quantity: 1, ...i };
}

/** Página de produto. */
export function trackViewItem(item: AnalyticsItem): void {
  rastrear(EVENTOS.PRODUTO, {
    produtoId: item.item_id,
    produtoNome: item.item_name,
    valor: round2(item.price),
  });
  gtag("event", "view_item", {
    currency: "BRL",
    value: round2(item.price),
    items: [comQtd(item)],
  });
}

/** Adição ao carrinho (produto ou feed). */
export function trackAddToCart(item: AnalyticsItem, quantity: number): void {
  rastrear(EVENTOS.CARRINHO_ADD, {
    produtoId: item.item_id,
    produtoNome: item.item_name,
    quantidade: quantity,
    valor: round2(item.price * quantity),
  });
  gtag("event", "add_to_cart", {
    currency: "BRL",
    value: round2(item.price * quantity),
    items: [{ ...item, quantity }],
  });
}

/** Saída do carrinho — não existe no GA4 e-commerce padrão, mas é justamente o
 * que o dono quer saber: de qual peixe as pessoas desistem. */
export function trackRemoveFromCart(item: AnalyticsItem, quantity: number): void {
  rastrear(EVENTOS.CARRINHO_REMOVE, {
    produtoId: item.item_id,
    produtoNome: item.item_name,
    quantidade: quantity,
    valor: round2(item.price * quantity),
  });
  gtag("event", "remove_from_cart", {
    currency: "BRL",
    value: round2(item.price * quantity),
    items: [{ ...item, quantity }],
  });
}

/** Entrada no checkout. */
export function trackBeginCheckout(items: AnalyticsItem[], value: number): void {
  rastrear(EVENTOS.CHECKOUT, { valor: round2(value), quantidade: items.length });
  gtag("event", "begin_checkout", {
    currency: "BRL",
    value: round2(value),
    items: items.map(comQtd),
  });
}

/** Seleção/confirmação do meio de pagamento (pix/cartão). */
export function trackAddPaymentInfo(
  items: AnalyticsItem[],
  value: number,
  paymentType: string,
): void {
  gtag("event", "add_payment_info", {
    currency: "BRL",
    value: round2(value),
    payment_type: paymentType,
    items: items.map(comQtd),
  });
}

/**
 * Compra (página de sucesso). DEDUP: dispara no máximo UMA vez por número de
 * pedido (flag em localStorage keyed pelo número) — a página pode re-renderizar
 * ou ser revisitada e a venda nunca pode contar duas vezes.
 */
export function trackPurchase(args: {
  transactionId: string;
  value: number;
  shipping: number;
  items: AnalyticsItem[];
}): void {
  if (typeof window === "undefined") return;
  const key = `ga_purchase:${args.transactionId}`;
  try {
    if (localStorage.getItem(key)) return; // já contado
    localStorage.setItem(key, "1");
  } catch {
    // storage indisponível: segue e dispara (melhor contar 1x do que falhar)
  }
  gtag("event", "purchase", {
    transaction_id: args.transactionId,
    currency: "BRL",
    value: round2(args.value),
    shipping: round2(args.shipping),
    items: args.items.map(comQtd),
  });
}
