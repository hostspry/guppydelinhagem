const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata um número como moeda brasileira (ex: 49.9 → "R$ 49,90"). */
export function formatBRL(value: number): string {
  return brl.format(value);
}
