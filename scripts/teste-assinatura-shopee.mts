/**
 * Confere a montagem da assinatura da Shopee com valores fixos.
 *
 * Existe porque "wrong sign" é o erro mais comum e mais mudo da Open Platform:
 * ela recusa sem dizer qual pedaço está errado. Com timestamp fixo, o HMAC é
 * determinístico — então dá para travar o formato aqui, sem credencial, sem
 * rede e sem loja aberta.
 *
 *   npx tsx scripts/teste-assinatura-shopee.mts
 *
 * Os valores abaixo são inventados. Se algum dia a Shopee mudar a ordem dos
 * pedaços, é este arquivo que quebra primeiro.
 */
import { createHmac } from "node:crypto";
import {
  assinar,
  assinaturaWebhook,
  baseString,
  montarUrl,
  urlAutorizacao,
} from "../lib/shopee/assinatura";

const PARTNER_ID = "1005678";
const PARTNER_KEY = "chave-de-teste-nao-e-real";
const TIMESTAMP = 1757462400; // fixo: assinatura precisa ser reproduzível
const SHOP_ID = "77001234";
const TOKEN = "access-token-de-teste";

let falhas = 0;
function conferir(nome: string, veio: unknown, esperado: unknown) {
  if (veio === esperado) {
    console.log(`ok    ${nome}`);
    return;
  }
  falhas++;
  console.log(`FALHA ${nome}`);
  console.log(`        esperava: ${esperado}`);
  console.log(`        veio:     ${veio}`);
}

// ── A string assinada, que é o que se compara com a documentação ──
conferir(
  "base pública = partner_id + path + timestamp",
  baseString({ partnerId: PARTNER_ID, path: "/api/v2/auth/token/get", timestamp: TIMESTAMP }),
  `${PARTNER_ID}/api/v2/auth/token/get${TIMESTAMP}`,
);

conferir(
  "base de loja = ... + access_token + shop_id",
  baseString({
    partnerId: PARTNER_ID,
    path: "/api/v2/order/get_order_list",
    timestamp: TIMESTAMP,
    accessToken: TOKEN,
    shopId: SHOP_ID,
  }),
  `${PARTNER_ID}/api/v2/order/get_order_list${TIMESTAMP}${TOKEN}${SHOP_ID}`,
);

// ── O HMAC em si ──
const esperadoLoja = createHmac("sha256", PARTNER_KEY)
  .update(`${PARTNER_ID}/api/v2/order/get_order_list${TIMESTAMP}${TOKEN}${SHOP_ID}`)
  .digest("hex");
conferir(
  "HMAC-SHA256 em hex minúsculo",
  assinar(PARTNER_KEY, {
    partnerId: PARTNER_ID,
    path: "/api/v2/order/get_order_list",
    timestamp: TIMESTAMP,
    accessToken: TOKEN,
    shopId: SHOP_ID,
  }),
  esperadoLoja,
);

// ── URL montada ──
const url = new URL(
  montarUrl({
    ambiente: "PRODUCAO",
    partnerId: PARTNER_ID,
    partnerKey: PARTNER_KEY,
    path: "/api/v2/order/get_order_list",
    timestamp: TIMESTAMP,
    accessToken: TOKEN,
    shopId: SHOP_ID,
    query: { time_range_field: "create_time", page_size: 50, vazio: "" },
  }),
);
conferir("host de produção", url.origin, "https://partner.shopeemobile.com");
conferir("caminho preservado", url.pathname, "/api/v2/order/get_order_list");
conferir("partner_id na query", url.searchParams.get("partner_id"), PARTNER_ID);
conferir("sign na query", url.searchParams.get("sign"), esperadoLoja);
conferir("shop_id na query", url.searchParams.get("shop_id"), SHOP_ID);
conferir("extra numérico vira texto", url.searchParams.get("page_size"), "50");
conferir("extra vazio é omitido", url.searchParams.get("vazio"), null);

// Chamada pública não pode vazar token nem shop_id na assinatura.
const publica = new URL(
  montarUrl({
    ambiente: "SANDBOX",
    partnerId: PARTNER_ID,
    partnerKey: PARTNER_KEY,
    path: "/api/v2/auth/token/get",
    timestamp: TIMESTAMP,
  }),
);
conferir("host de sandbox", publica.origin, "https://partner.test-stable.shopeemobile.com");
conferir("pública não leva access_token", publica.searchParams.get("access_token"), null);
conferir(
  "pública assina só os três pedaços",
  publica.searchParams.get("sign"),
  createHmac("sha256", PARTNER_KEY)
    .update(`${PARTNER_ID}/api/v2/auth/token/get${TIMESTAMP}`)
    .digest("hex"),
);

// ── Link de autorização ──
const auth = new URL(
  urlAutorizacao({
    ambiente: "PRODUCAO",
    partnerId: PARTNER_ID,
    partnerKey: PARTNER_KEY,
    redirect: "https://guppydelinhagem.com.br/api/shopee/callback",
    timestamp: TIMESTAMP,
  }),
);
conferir("autorização aponta para auth_partner", auth.pathname, "/api/v2/shop/auth_partner");
conferir(
  "redirect vai inteiro (e escapado)",
  auth.searchParams.get("redirect"),
  "https://guppydelinhagem.com.br/api/shopee/callback",
);

// ── Webhook ──
conferir(
  "webhook assina url|corpo",
  assinaturaWebhook(PARTNER_KEY, "https://x.com/hook", '{"code":3}'),
  createHmac("sha256", PARTNER_KEY).update('https://x.com/hook|{"code":3}').digest("hex"),
);

console.log(`\n${falhas === 0 ? "tudo certo" : `${falhas} falha(s)`}`);
process.exit(falhas > 0 ? 1 : 0);
