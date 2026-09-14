import "server-only";
import { prisma } from "@/lib/prisma";
import { criptografar, descriptografar } from "@/lib/cripto";

/**
 * Conversa com o Mercado Livre: credenciais, token e chamada autenticada.
 *
 * Nada aqui lança para o chamador — devolve `{ ok: false, erro }`. Mesmo acordo
 * da Shopee e do Melhor Envio: marketplace fora do ar não pode derrubar o painel
 * nem o cron, e quem chama precisa poder decidir se tenta de novo.
 *
 * A diferença que manda no código é o refresh_token: no ML ele é de **uso
 * único**. Cada renovação devolve um novo, e quem não gravar o novo perde a
 * autorização — o dono teria que autorizar a conta de novo na mão. Por isso a
 * gravação do par novo acontece antes de qualquer outra coisa na renovação.
 */

const API = "https://api.mercadolibre.com";
const AUTORIZACAO = "https://auth.mercadolivre.com.br/authorization";
const TIMEOUT_MS = 20_000;

/** Sobra antes de o token vencer. 6 h de validade, renovamos com 10 min de folga. */
const FOLGA_MS = 10 * 60 * 1000;
/** O refresh_token vale 6 meses. Avisamos antes de virar pó. */
const DIAS_REFRESH = 180;

export type MlResult<T> =
  | { ok: true; dados: T }
  | { ok: false; erro: string; status?: number };

export type CredenciaisMl = {
  clientId: string;
  clientSecret: string;
  sellerId: string | null;
  apelido: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiraEm: Date | null;
  refreshEmitidoEm: Date | null;
  ativo: boolean;
};

/** Lê a linha única e devolve as chaves já em texto. */
export async function credenciais(): Promise<CredenciaisMl | null> {
  const row = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
  });
  if (!row?.clientId || !row.clientSecretCriptografado) return null;

  try {
    return {
      clientId: row.clientId,
      clientSecret: descriptografar(row.clientSecretCriptografado),
      sellerId: row.sellerId,
      apelido: row.apelido,
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
    // dizer isso do que devolver credencial pela metade e culpar o ML.
    console.error("[ml] não consegui abrir as credenciais", e);
    return null;
  }
}

/** Grava o último erro para a tela de configuração mostrar sem inventar. */
async function anotarErro(erro: string | null): Promise<void> {
  await prisma.integracaoMercadoLivre
    .update({ where: { id: "default" }, data: { ultimoErro: erro } })
    .catch(() => {});
}

/** Dias até a autorização morrer por falta de renovação (null = sem dado). */
export function diasAteExpirarAutorizacao(
  refreshEmitidoEm: Date | null,
): number | null {
  if (!refreshEmitidoEm) return null;
  const fim = refreshEmitidoEm.getTime() + DIAS_REFRESH * 24 * 60 * 60 * 1000;
  return Math.ceil((fim - Date.now()) / (24 * 60 * 60 * 1000));
}

/** URL da tela de autorização do ML (o dono clica e escolhe a conta). */
export function urlAutorizacao(params: {
  clientId: string;
  redirect: string;
}): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirect,
  });
  return `${AUTORIZACAO}?${q.toString()}`;
}

type RespostaToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
  error?: string;
  message?: string;
};

/** POST no /oauth/token. Corpo em form-urlencoded, como o ML espera. */
async function pedirToken(
  corpo: Record<string, string>,
): Promise<MlResult<RespostaToken>> {
  let resp: Response;
  try {
    resp = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(corpo).toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, erro: "Não foi possível falar com o Mercado Livre agora." };
  }

  const texto = await resp.text();
  let dados: RespostaToken = {};
  try {
    dados = texto ? (JSON.parse(texto) as RespostaToken) : {};
  } catch {
    dados = {};
  }

  if (!resp.ok || !dados.access_token) {
    const msg =
      dados.message || dados.error || `Mercado Livre respondeu ${resp.status}.`;
    console.error("[ml] token", resp.status, msg);
    return { ok: false, erro: msg, status: resp.status };
  }
  return { ok: true, dados };
}

/** Guarda o par de tokens. Chamado na autorização e em toda renovação. */
async function gravarTokens(
  d: RespostaToken,
  extras: { sellerId?: string; apelido?: string } = {},
): Promise<void> {
  const expiraEm = new Date(Date.now() + (d.expires_in ?? 21600) * 1000);
  await prisma.integracaoMercadoLivre.update({
    where: { id: "default" },
    data: {
      accessTokenCriptografado: criptografar(d.access_token as string),
      ...(d.refresh_token
        ? {
            refreshTokenCriptografado: criptografar(d.refresh_token),
            refreshEmitidoEm: new Date(),
          }
        : {}),
      tokenExpiraEm: expiraEm,
      ...(extras.sellerId ? { sellerId: extras.sellerId } : {}),
      ...(extras.apelido ? { apelido: extras.apelido } : {}),
      ultimoErro: null,
    },
  });
}

/**
 * Troca o `code` da autorização pelo primeiro par de tokens e descobre quem é o
 * vendedor. O code vale uma vez só e por poucos minutos — por isso o callback
 * faz a troca na hora, sem passar por tela nenhuma.
 */
export async function trocarCodePorToken(
  code: string,
  redirect: string,
): Promise<MlResult<{ sellerId: string; apelido: string | null }>> {
  const c = await credenciais();
  if (!c) return { ok: false, erro: "Salve o App ID e o Secret antes." };

  const r = await pedirToken({
    grant_type: "authorization_code",
    client_id: c.clientId,
    client_secret: c.clientSecret,
    code,
    redirect_uri: redirect,
  });
  if (!r.ok) {
    await anotarErro(r.erro);
    return r;
  }

  const sellerId = String(r.dados.user_id ?? "");
  await gravarTokens(r.dados, { sellerId: sellerId || undefined });

  // Apelido é cosmético: se falhar, a ligação continua de pé.
  let apelido: string | null = null;
  const eu = await chamarMl<{ nickname?: string }>("/users/me");
  if (eu.ok) {
    apelido = eu.dados?.nickname ?? null;
    if (apelido) {
      await prisma.integracaoMercadoLivre
        .update({ where: { id: "default" }, data: { apelido } })
        .catch(() => {});
    }
  }

  return { ok: true, dados: { sellerId, apelido } };
}

/**
 * Renova o access_token quando falta pouco (ou já venceu).
 *
 * Idempotente de propósito: quem chama não precisa saber se está perto do fim.
 * Token ainda válido devolve ok sem gastar chamada.
 */
export async function renovarToken(
  forcar = false,
): Promise<MlResult<{ renovado: boolean }>> {
  const c = await credenciais();
  if (!c) return { ok: false, erro: "Mercado Livre não configurado." };
  if (!c.refreshToken) {
    return { ok: false, erro: "Conta não autorizada. Autorize a loja primeiro." };
  }

  const venceEm = c.tokenExpiraEm?.getTime() ?? 0;
  const precisa = forcar || venceEm - Date.now() < FOLGA_MS;
  if (!precisa && c.accessToken) return { ok: true, dados: { renovado: false } };

  const r = await pedirToken({
    grant_type: "refresh_token",
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: c.refreshToken,
  });
  if (!r.ok) {
    await anotarErro(`Renovação falhou: ${r.erro}`);
    return r;
  }

  // O novo refresh_token vem aqui dentro e o antigo já morreu. Gravar é a parte
  // que não pode falhar: sem o novo, a próxima renovação não tem como acontecer.
  await gravarTokens(r.dados);
  return { ok: true, dados: { renovado: true } };
}

/**
 * Chamada autenticada à API. Renova o token antes quando precisa e tenta de novo
 * uma única vez se o ML devolver 401 (token revogado ou fora de hora).
 */
export async function chamarMl<T>(
  caminho: string,
  init: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<MlResult<T>> {
  const c = await credenciais();
  if (!c) return { ok: false, erro: "Mercado Livre não configurado." };

  const renovacao = await renovarToken();
  if (!renovacao.ok) return renovacao;

  const atual = await credenciais();
  const token = atual?.accessToken;
  if (!token) {
    return { ok: false, erro: "Conta não autorizada. Autorize a loja primeiro." };
  }

  const executar = async (bearer: string): Promise<Response | null> => {
    try {
      return await fetch(`${API}${caminho}`, {
        method: init.method ?? "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
        },
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      return null;
    }
  };

  let resp = await executar(token);
  if (!resp) {
    return { ok: false, erro: "Não foi possível falar com o Mercado Livre agora." };
  }

  if (resp.status === 401) {
    // Token derrubado antes da hora. Uma tentativa de renovar e repetir; se
    // falhar de novo, é autorização morta mesmo e o dono precisa refazer.
    const forcado = await renovarToken(true);
    if (!forcado.ok) return forcado;
    const novo = (await credenciais())?.accessToken;
    if (!novo) return { ok: false, erro: "Conta não autorizada." };
    const segunda = await executar(novo);
    if (!segunda) {
      return { ok: false, erro: "Não foi possível falar com o Mercado Livre agora." };
    }
    resp = segunda;
  }

  const texto = await resp.text();
  let dados: unknown = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = null;
  }

  if (!resp.ok) {
    const obj = (dados ?? {}) as { message?: string; error?: string };
    const msg = obj.message || obj.error || `Mercado Livre respondeu ${resp.status}.`;
    console.error("[ml]", caminho, resp.status, msg);
    await anotarErro(msg);
    return { ok: false, erro: msg, status: resp.status };
  }

  return { ok: true, dados: dados as T };
}
