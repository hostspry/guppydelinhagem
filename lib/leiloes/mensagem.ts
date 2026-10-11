/**
 * Mensagem de cobrança do leilão para o WhatsApp. Módulo PURO: o botão do
 * painel e a prévia para aprovação usam o mesmo texto.
 *
 * Tom de criador falando com cliente (sem travessão, primeira pessoa). Nada de
 * prazo: o "pagar em até 48h" é combinado do grupo, não vai no link.
 */

const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "PAMELA DE OLIVEIRA" → "Pamela"; contato salvo só pelo número → null. */
function primeiroNome(nome: string): string | null {
  const p = nome.trim().split(/\s+/)[0] ?? "";
  if (!p || /^\+?\d/.test(p)) return null;
  return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR");
}

export function mensagemCobrancaLeilao(c: {
  clienteNome: string;
  dataLeilao: string; // "09/10/2026"
  itens: { nome: string; valor: number }[];
  subtotal: number;
  link: string | null;
}): string {
  const nome = primeiroNome(c.clienteNome);
  const titulo =
    c.itens.length === 1
      ? `Parabéns pelo lote arrematado no leilão de ${c.dataLeilao}:`
      : `Parabéns pelos ${c.itens.length} lotes arrematados no leilão de ${c.dataLeilao}:`;
  const lotes = c.itens.map((i) => `• ${i.nome}: ${moeda(i.valor)}`).join("\n");
  return [
    nome ? `Oi, ${nome}! Tudo bem?` : "Oi! Tudo bem?",
    "",
    titulo,
    "",
    lotes,
    "",
    `Total dos lotes: ${moeda(c.subtotal)}`,
    "",
    "Neste link você escolhe o frete e paga no Pix ou no cartão:",
    c.link ?? "",
    "",
    "Qualquer dúvida, é só me chamar aqui.",
  ].join("\n");
}
