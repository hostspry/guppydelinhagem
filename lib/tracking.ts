import type { Transportadora } from "@/lib/generated/prisma/enums";

// Helpers de rastreio — montam o link do cliente e a mensagem/URL de WhatsApp.
// Isomórfico (sem `server-only`): usado no server (notificação) e no client (card
// do admin). Fonte ÚNICA de link/mensagem — não duplicar em outro lugar.

/** Rótulo amigável da transportadora (fallback pro próprio valor). */
export function transportadoraLabel(t: Transportadora | null): string {
  switch (t) {
    case "JADLOG":
      return "Jadlog";
    case "GOLLOG":
      return "Gollog";
    default:
      return "transportadora";
  }
}

/**
 * Link de rastreio do CLIENTE = Melhor Rastreio (um clique, sem CPF/captcha).
 * Prefere o `selfTracking` (código ME…BR) — é o que o Melhor Rastreio entende
 * melhor; cai no código digitado quando não há self_tracking (envio manual).
 * Sem nenhum código → null (o chamador omite o link).
 */
export function buildTrackingUrl(
  selfTracking: string | null | undefined,
  codigo: string | null | undefined,
): string | null {
  const cod = (selfTracking || codigo || "").trim();
  if (!cod) return null;
  return `https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(cod)}`;
}

/** Primeira palavra do nome (saudação). */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome.trim();
}

/**
 * Mensagem de rastreio pro cliente (tom da marca: direto, caloroso, sem travessão
 * nem palavra inflada). Omite a linha do link se não houver URL, mantendo o código.
 */
export function mensagemRastreio(params: {
  nomeCliente: string;
  numeroPedido: string;
  transportadora: Transportadora | null;
  codigo: string;
  url: string | null;
}): string {
  const via =
    params.transportadora && params.transportadora !== "OUTRO"
      ? ` pela ${transportadoraLabel(params.transportadora)}`
      : "";
  const base = `Oi, ${primeiroNome(params.nomeCliente)}! Tudo certo? Seu pedido ${params.numeroPedido} na Guppy de Linhagem já saiu pra entrega${via}.`;
  const rastreio = params.url
    ? ` Você acompanha aqui: ${params.url} (código ${params.codigo}).`
    : ` Código de rastreio: ${params.codigo}.`;
  return `${base}${rastreio} Qualquer novidade eu te aviso!`;
}

/**
 * URL wa.me pro telefone do CLIENTE com a mensagem preenchida. Normaliza o número
 * (só dígitos, prefixa 55 se faltar). Devolve null se o telefone for curto demais.
 * ATENÇÃO: é o número do cliente — NÃO confundir com whatsappLink() de constants,
 * que aponta pro número da LOJA.
 */
export function whatsappRastreioLink(
  telefone: string | null | undefined,
  mensagem: string,
): string | null {
  let d = (telefone || "").replace(/\D/g, "");
  if (d.length < 10) return null;
  if (!d.startsWith("55")) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}`;
}
