/**
 * Trunca `s` para caber em `max` caracteres, cortando na última palavra inteira
 * (não corta palavra no meio). Usado como rede de segurança nos campos com
 * limite preenchidos pela IA — o modelo não conta caracteres com precisão e
 * pode estourar; isto garante que o save nunca trave por tamanho.
 */
export function truncateAtWord(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Se não houver espaço (uma palavra gigante), corta no limite mesmo.
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim();
}
