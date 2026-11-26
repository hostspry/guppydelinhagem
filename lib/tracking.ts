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

// O id de um envio no Melhor Envio é um UUID, e por um tempo ele foi gravado em
// selfTracking como se fosse rastreio. Não é código de nada: não abre no Melhor
// Rastreio e não serve para o cliente. Fica esta guarda para os pedidos que já
// nasceram assim não mostrarem um código que ninguém consegue usar.
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** É um código que dá para rastrear (ou pelo menos mostrar ao cliente)? */
export function codigoRastreavel(
  codigo: string | null | undefined,
): codigo is string {
  const c = (codigo ?? "").trim();
  return c.length > 0 && !UUID.test(c);
}

/**
 * Rastreio da Gollog. O AWB não vai no link: a página só mostra o resultado
 * depois da busca feita nela (com o código na URL ela abre vazia). O Melhor
 * Rastreio lê o AWB como Jadlog e não acha nada. Então o cliente abre esta
 * página e digita o código, só os números.
 */
export const RASTREIO_GOLLOG_URL = "https://servicos.gollog.com.br/app/site/tracking";

/**
 * Link de rastreio do CLIENTE = Melhor Rastreio (um clique, sem CPF/captcha).
 * Prefere o `selfTracking` (código ME…BR) — é o que o Melhor Rastreio entende
 * melhor; cai no código digitado quando não há self_tracking (envio manual).
 * Aéreo (Gollog) vai para a página de rastreio da Gollog.
 * Sem nenhum código → null (o chamador omite o link).
 */
export function buildTrackingUrl(
  selfTracking: string | null | undefined,
  codigo: string | null | undefined,
  transportadora?: Transportadora | null,
): string | null {
  if (transportadora === "GOLLOG") {
    return codigoRastreavel(codigo) ? RASTREIO_GOLLOG_URL : null;
  }
  const cod = [selfTracking, codigo].find(codigoRastreavel);
  if (!cod) return null;
  return `https://www.melhorrastreio.com.br/rastreio/${encodeURIComponent(cod.trim())}`;
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
  const rastreio = !params.url
    ? ` Código de rastreio: ${params.codigo}.`
    : params.transportadora === "GOLLOG"
      ? ` Você acompanha em ${params.url}, digitando o código ${params.codigo.replace(/\D/g, "")}. Na retirada, leve um documento com foto e o código.`
      : ` Você acompanha aqui: ${params.url} (código ${params.codigo}).`;
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

/**
 * A etiqueta deste envio ainda vale?
 *
 * Cancelada no Melhor Envio (greve, endereço errado, serviço trocado), o
 * pedido guarda tudo como antes — id do envio, PDF, código — e nada disso
 * serve: o PDF ainda abre, e postar esse papel é caixa devolvida. Como o
 * painel, o poll do rastreio e a compra precisam concordar sobre o que é uma
 * etiqueta morta, a lista mora aqui e não em cada arquivo.
 */
const ETIQUETA_MORTA = new Set(["canceled", "cancelled", "expired"]);

export function etiquetaCancelada(status: string | null | undefined): boolean {
  return ETIQUETA_MORTA.has((status ?? "").trim().toLowerCase());
}
