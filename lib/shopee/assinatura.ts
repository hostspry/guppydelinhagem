import { createHmac } from "node:crypto";

/**
 * Assinatura das chamadas à Shopee Open Platform v2.
 *
 * Módulo PURO: sem banco, sem rede, sem `server-only`. É o pedaço que mais dá
 * errado numa integração dessas — a Shopee recusa com "wrong sign" sem dizer o
 * que está errado — então ele precisa ser exercitável com valores conhecidos.
 * Ver scripts/teste-assinatura-shopee.mts.
 *
 * A regra: HMAC-SHA256 sobre uma string montada em ORDEM FIXA, com a
 * partner_key como segredo, em hexadecimal minúsculo. O que entra na string
 * muda conforme o tipo de chamada:
 *
 *   pública (pegar/renovar token):  partner_id + path + timestamp
 *   de loja (o resto):              partner_id + path + timestamp + access_token + shop_id
 *
 * Nada de separador entre os pedaços, e o `path` é só o caminho ("/api/v2/...")
 * — sem host e sem query string.
 */

/** Host da API por ambiente. Sandbox e produção têm credenciais separadas. */
export const HOSTS = {
  SANDBOX: "https://partner.test-stable.shopeemobile.com",
  PRODUCAO: "https://partner.shopeemobile.com",
} as const;

export type AmbienteShopee = keyof typeof HOSTS;

/** Segundos desde a época. A Shopee recusa timestamp fora de ±5 min do dela. */
export const agoraEmSegundos = (): number => Math.floor(Date.now() / 1000);

export type BaseAssinatura = {
  partnerId: string;
  path: string;
  timestamp: number;
  /** Só nas chamadas de loja. */
  accessToken?: string;
  shopId?: string;
};

/**
 * A string que vai ser assinada. Exposta separada da assinatura porque, quando
 * a Shopee recusa, é ela que se compara com a documentação — e ninguém consegue
 * comparar um HMAC.
 */
export function baseString(b: BaseAssinatura): string {
  const inicio = `${b.partnerId}${b.path}${b.timestamp}`;
  if (!b.accessToken && !b.shopId) return inicio;
  return `${inicio}${b.accessToken ?? ""}${b.shopId ?? ""}`;
}

export function assinar(partnerKey: string, base: BaseAssinatura): string {
  return createHmac("sha256", partnerKey).update(baseString(base)).digest("hex");
}

/**
 * URL completa, já com os parâmetros que TODA chamada leva.
 *
 * Os parâmetros de autenticação vão na query string mesmo em POST — é assim que
 * a Shopee espera, e o corpo carrega só os dados da operação.
 */
export function montarUrl(args: {
  ambiente: AmbienteShopee;
  partnerId: string;
  partnerKey: string;
  path: string;
  timestamp?: number;
  accessToken?: string;
  shopId?: string;
  /** Parâmetros extras de GET (a Shopee tem vários que não vão no corpo). */
  query?: Record<string, string | number | undefined>;
}): string {
  const timestamp = args.timestamp ?? agoraEmSegundos();
  const base: BaseAssinatura = {
    partnerId: args.partnerId,
    path: args.path,
    timestamp,
    accessToken: args.accessToken,
    shopId: args.shopId,
  };

  const url = new URL(args.path, HOSTS[args.ambiente]);
  url.searchParams.set("partner_id", args.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", assinar(args.partnerKey, base));
  if (args.accessToken) url.searchParams.set("access_token", args.accessToken);
  if (args.shopId) url.searchParams.set("shop_id", args.shopId);
  for (const [k, v] of Object.entries(args.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

/**
 * Link da tela onde o dono autoriza a loja.
 *
 * Aqui a assinatura é a pública (sem token, que ainda não existe) e o `redirect`
 * precisa bater com o que está cadastrado no app da Open Platform — a Shopee
 * compara, e devolve erro se sobrar até uma barra.
 */
export function urlAutorizacao(args: {
  ambiente: AmbienteShopee;
  partnerId: string;
  partnerKey: string;
  redirect: string;
  timestamp?: number;
}): string {
  const path = "/api/v2/shop/auth_partner";
  const timestamp = args.timestamp ?? agoraEmSegundos();
  const sign = assinar(args.partnerKey, {
    partnerId: args.partnerId,
    path,
    timestamp,
  });
  const url = new URL(path, HOSTS[args.ambiente]);
  url.searchParams.set("partner_id", args.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", sign);
  url.searchParams.set("redirect", args.redirect);
  return url.toString();
}

/**
 * Assinatura do webhook (push) da Shopee.
 *
 * Ela manda o header `Authorization` com HMAC-SHA256 de `url|corpo`, onde a url
 * é a que está cadastrada no app. Conferir isso é o que separa um aviso da
 * Shopee de qualquer um que descubra o endereço e mande um pedido inventado.
 */
export function assinaturaWebhook(
  partnerKey: string,
  urlCadastrada: string,
  corpoBruto: string,
): string {
  return createHmac("sha256", partnerKey)
    .update(`${urlCadastrada}|${corpoBruto}`)
    .digest("hex");
}
