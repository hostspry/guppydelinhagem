import "server-only";
import { prisma } from "@/lib/prisma";
import { criptografar, descriptografar } from "@/lib/cripto";
import {
  agoraEmSegundos,
  assinar,
  montarUrl,
  type AmbienteShopee,
} from "./assinatura";

/**
 * Conversa com a Shopee: credenciais, token e chamada assinada.
 *
 * Nada aqui lança para o chamador — devolve `{ ok: false, erro }`. É o mesmo
 * acordo do Melhor Envio: marketplace fora do ar não pode derrubar o painel nem
 * o cron, e quem chama precisa poder decidir se tenta de novo.
 */

export type ShopeeResult<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; codigo?: string };

/** Sobra antes de o token vencer. 4 h de validade, renovamos com 10 min de folga. */
const FOLGA_MS = 10 * 60 * 1000;
/** A Shopee derruba a autorização com 30 dias sem renovar. Avisamos antes. */
const DIAS_REFRESH = 30;

const TIMEOUT_MS = 20_000;

export type Credenciais = {
  ambiente: AmbienteShopee;
  partnerId: string;
  partnerKey: string;
  shopId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiraEm: Date | null;
  refreshEmitidoEm: Date | null;
  ativo: boolean;
};

/** Lê a linha única e devolve as chaves já em texto. */
export async function credenciais(): Promise<Credenciais | null> {
  const row = await prisma.integracaoShopee.findUnique({ where: { id: "default" } });
  if (!row?.partnerId || !row.partnerKeyCriptografada) return null;

  try {
    return {
      ambiente: row.ambiente,
      partnerId: row.partnerId,
      partnerKey: descriptografar(row.partnerKeyCriptografada),
      shopId: row.shopId,
      accessToken: row.accessTokenCriptografado
        ? descriptografar(row.accessTokenCriptografado)
        : null,
      refreshToken: row.refreshTokenCriptografado
        ? descriptografar(row.refreshTokenCriptografado)
        : null,
      tokenExpiraEm: row.tokenExpiraEm,
      refreshEmitidoEm: row.refreshEmitidoEm,
      ativo: row.ativo,
    };
  } catch (e) {
    // AUTH_SECRET trocado depois de salvar: o texto cifrado vira lixo. Melhor
    // dizer isso do que devolver credencial pela metade e culpar a Shopee.
    console.error("[shopee] não consegui abrir as credenciais", e);
    return null;
  }
}

/** Grava o último erro para a tela de configuração mostrar sem inventar. */
async function anotarErro(erro: string | null): Promise<void> {
  await prisma.integracaoShopee
    .update({ where: { id: "default" }, data: { ultimoErro: erro } })
    .catch(() => {});
}

type RespostaShopee = {
  error?: string;
  message?: string;
  request_id?: string;
  response?: unknown;
  [k: string]: unknown;
};

/**
 * Faz a chamada crua e normaliza a resposta.
 *
 * A Shopee responde 200 mesmo quando recusa: o que separa sucesso de erro é o
 * campo `error` vir vazio. Tratar só o status HTTP faria erro de negócio passar
 * por sucesso — e um pedido entraria pela metade.
 */
async function chamar<T>(
  url: string,
  corpo?: unknown,
): Promise<ShopeeResult<T>> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: corpo === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, erro: `Não consegui falar com a Shopee: ${msg}` };
  }

  let json: RespostaShopee;
  try {
    json = (await resposta.json()) as RespostaShopee;
  } catch {
    return {
      ok: false,
      erro: `A Shopee respondeu ${resposta.status} sem JSON. Provável instabilidade dela.`,
    };
  }

  if (json.error) {
    return {
      ok: false,
      codigo: json.error,
      erro: traduzir(json.error, json.message ?? ""),
    };
  }
  // Algumas rotas devolvem em `response`, outras no topo. Normaliza aqui para o
  // resto do código não ter que saber de qual jeito cada uma responde.
  return { ok: true, dados: (json.response ?? json) as T };
}

/** Erro da Shopee em algo que o dono resolva sozinho. */
function traduzir(codigo: string, mensagem: string): string {
  const c = codigo.toLowerCase();
  if (c.includes("sign")) {
    return "Assinatura recusada. Confira se a partner key colada é a do mesmo ambiente (sandbox ou produção) do partner ID.";
  }
  if (c.includes("token") && (c.includes("expire") || c.includes("invalid"))) {
    return "A autorização da loja venceu. Autorize a loja de novo na tela da Shopee.";
  }
  if (c.includes("permission") || c.includes("auth")) {
    return "O app não tem permissão para isso. Confira no painel da Open Platform se a API está marcada no seu app.";
  }
  if (c.includes("timestamp")) {
    return "A Shopee recusou o horário da chamada. O relógio do servidor está fora de hora.";
  }
  return `${codigo}${mensagem ? `: ${mensagem}` : ""}`;
}

// ── Token ─────────────────────────────────────────────────────────────────────

type RespostaToken = {
  access_token?: string;
  refresh_token?: string;
  expire_in?: number; // segundos (14400 = 4 h)
};

async function gravarToken(
  r: RespostaToken,
  shopId?: string,
): Promise<ShopeeResult<void>> {
  if (!r.access_token || !r.refresh_token) {
    return { ok: false, erro: "A Shopee não devolveu o token." };
  }
  const validade = (r.expire_in ?? 14400) * 1000;
  await prisma.integracaoShopee.update({
    where: { id: "default" },
    data: {
      accessTokenCriptografado: criptografar(r.access_token),
      refreshTokenCriptografado: criptografar(r.refresh_token),
      tokenExpiraEm: new Date(Date.now() + validade),
      refreshEmitidoEm: new Date(),
      ultimoErro: null,
      ...(shopId ? { shopId } : {}),
    },
  });
  return { ok: true, dados: undefined };
}

/**
 * Troca o `code` que volta da tela de autorização pelo primeiro token.
 *
 * O code vale uma vez só e por pouco tempo — por isso o callback chama isto na
 * hora, em vez de guardar o code para depois.
 */
export async function trocarCodePorToken(
  code: string,
  shopId: string,
): Promise<ShopeeResult<void>> {
  const c = await credenciais();
  if (!c) return { ok: false, erro: "Configure o partner ID e a partner key antes." };

  const path = "/api/v2/auth/token/get";
  const url = montarUrl({
    ambiente: c.ambiente,
    partnerId: c.partnerId,
    partnerKey: c.partnerKey,
    path,
  });
  const r = await chamar<RespostaToken>(url, {
    code,
    shop_id: Number(shopId),
    partner_id: Number(c.partnerId),
  });
  if (!r.ok) {
    await anotarErro(r.erro);
    return r;
  }
  return gravarToken(r.dados, shopId);
}

/** Renova o access_token com o refresh_token. */
export async function renovarToken(): Promise<ShopeeResult<void>> {
  const c = await credenciais();
  if (!c) return { ok: false, erro: "Integração não configurada." };
  if (!c.refreshToken || !c.shopId) {
    return { ok: false, erro: "A loja ainda não foi autorizada." };
  }

  const path = "/api/v2/auth/access_token/get";
  const url = montarUrl({
    ambiente: c.ambiente,
    partnerId: c.partnerId,
    partnerKey: c.partnerKey,
    path,
  });
  const r = await chamar<RespostaToken>(url, {
    refresh_token: c.refreshToken,
    shop_id: Number(c.shopId),
    partner_id: Number(c.partnerId),
  });
  if (!r.ok) {
    await anotarErro(r.erro);
    return r;
  }
  return gravarToken(r.dados, c.shopId);
}

/** Token válido agora, renovando se estiver perto de vencer. */
async function tokenValido(): Promise<ShopeeResult<Credenciais>> {
  let c = await credenciais();
  if (!c) return { ok: false, erro: "Integração com a Shopee não configurada." };
  if (!c.ativo) return { ok: false, erro: "Integração com a Shopee está desligada." };
  if (!c.shopId || !c.accessToken) {
    return { ok: false, erro: "A loja ainda não foi autorizada na Shopee." };
  }

  const vencido =
    !c.tokenExpiraEm || c.tokenExpiraEm.getTime() - FOLGA_MS <= Date.now();
  if (vencido) {
    const r = await renovarToken();
    if (!r.ok) return r;
    c = await credenciais();
    if (!c?.accessToken) {
      return { ok: false, erro: "Renovei o token e ele não voltou. Autorize a loja de novo." };
    }
  }
  return { ok: true, dados: c };
}

/**
 * Chamada autenticada, do jeito que o resto do código deve usar.
 *
 * Se a Shopee disser que o token não serve, renova UMA vez e repete. Uma só:
 * token recusado duas vezes seguidas é autorização morta, e insistir viraria
 * laço em cima de um erro que só o dono resolve, reautorizando a loja.
 */
export async function chamarShopee<T>(
  path: string,
  opcoes: {
    query?: Record<string, string | number | undefined>;
    corpo?: unknown;
  } = {},
): Promise<ShopeeResult<T>> {
  const v = await tokenValido();
  if (!v.ok) return v;

  const montar = (c: Credenciais) =>
    montarUrl({
      ambiente: c.ambiente,
      partnerId: c.partnerId,
      partnerKey: c.partnerKey,
      path,
      accessToken: c.accessToken ?? undefined,
      shopId: c.shopId ?? undefined,
      query: opcoes.query,
    });

  let r = await chamar<T>(montar(v.dados), opcoes.corpo);
  const tokenRecusado =
    !r.ok && (r.codigo ?? "").toLowerCase().includes("token");

  if (tokenRecusado) {
    const renovou = await renovarToken();
    if (!renovou.ok) return renovou;
    const c = await credenciais();
    if (!c) return { ok: false, erro: "Integração não configurada." };
    r = await chamar<T>(montar(c), opcoes.corpo);
  }

  if (!r.ok) await anotarErro(r.erro);
  return r;
}

/** Quantos dias faltam para a autorização morrer por falta de uso. */
export function diasAteExpirarAutorizacao(
  refreshEmitidoEm: Date | null,
): number | null {
  if (!refreshEmitidoEm) return null;
  const passados = (Date.now() - refreshEmitidoEm.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.round(DIAS_REFRESH - passados));
}

/** Assinatura pública, usada pelo callback da autorização. */
export { assinar, agoraEmSegundos };
