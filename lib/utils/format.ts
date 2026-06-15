const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata um número como moeda brasileira (ex: 49.9 → "R$ 49,90"). */
export function formatBRL(value: number): string {
  return brl.format(value);
}

/**
 * Formata telefone só-dígitos para exibição: celular 11 díg → "(27) 99602-4171",
 * fixo 10 díg → "(27) 9602-4171". Formato inesperado: devolve como veio.
 * (No banco o telefone é guardado só com dígitos; formatar é só na exibição.)
 */
export function formatTelefone(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length === 11)
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

/**
 * Formata CPF (11 díg → "000.000.000-00") ou CNPJ (14 díg →
 * "00.000.000/0000-00") conforme o nº de dígitos. Formato inesperado: devolve
 * como veio. (No banco é guardado só com dígitos.)
 */
export function formatCpfCnpj(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length === 11)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return value;
}
