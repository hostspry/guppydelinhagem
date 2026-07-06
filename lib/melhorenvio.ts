import "server-only";

// Cliente da API do Melhor Envio para o PIPELINE DE ETIQUETA (carrinho → compra →
// gerar → imprimir → rastreio). Server-only: o token nunca vai ao client (o
// `server-only` quebra o build se importado de um Client Component).
//
// ⚠️ DINHEIRO REAL: `comprarEtiquetas` (checkout) DEBITA o saldo da conta Melhor
// Envio. Sempre cotar e confirmar o valor ANTES de chamar. As demais funções não
// gastam saldo (carrinho, gerar, imprimir e rastreio operam sobre etiquetas já
// compradas ou são leitura).
//
// Doc: docs.melhorenvio.com.br — Envios (cart / shipment). A cotação de frete pura
// (calculate) fica em lib/shipping.ts; aqui é o fluxo de compra/geração.

type MeEnv = "sandbox" | "production";

function meEnv(): MeEnv {
  return process.env.MELHOR_ENVIO_ENV === "sandbox" ? "sandbox" : "production";
}

// Produção usa o host melhorenvio.com.br (mesmo do frete em lib/shipping.ts).
function meBase(): string {
  return meEnv() === "sandbox"
    ? "https://sandbox.melhorenvio.com.br"
    : "https://melhorenvio.com.br";
}

function meToken(): string {
  const t = process.env.MELHOR_ENVIO_TOKEN;
  if (!t) throw new Error("MELHOR_ENVIO_TOKEN não configurado.");
  return t;
}

// User-Agent com contato é OBRIGATÓRIO na API do ME (rejeita sem ele).
const USER_AGENT = "Guppy de Linhagem (hospedagemsegura@gmail.com)";

export type MeResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/**
 * Cliente HTTP fino do Melhor Envio. Bearer + headers padrão. Nunca lança: devolve
 * um resultado discriminado (ok/erro) com a mensagem da API quando houver, pra o
 * chamador decidir (a atomicidade da geração de etiqueta depende disso). `cache:
 * no-store` sempre — nada de rastreio/etiqueta cacheado.
 */
async function meFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<MeResult<T>> {
  let resp: Response;
  try {
    resp = await fetch(`${meBase()}${path}`, {
      method: init.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${meToken()}`,
        "User-Agent": USER_AGENT,
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 502, error: "Não foi possível falar com o Melhor Envio agora." };
  }

  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!resp.ok) {
    // ME devolve {message} e/ou {errors:{campo:[msgs]}}. Monta a mensagem mais útil.
    const obj = (data ?? {}) as {
      message?: string;
      error?: string;
      errors?: Record<string, string[]>;
    };
    const primeiroErro =
      obj.errors && Object.values(obj.errors)[0]?.[0];
    const msg =
      primeiroErro || obj.message || obj.error || `Melhor Envio respondeu ${resp.status}.`;
    console.error("[melhorenvio]", path, resp.status, msg);
    return { ok: false, status: resp.status, error: msg };
  }
  return { ok: true, data: data as T };
}

// ── Tipos do pipeline ────────────────────────────────────────────────────────

export type MeEndereco = {
  name: string;
  email: string;
  phone: string; // só dígitos
  document?: string; // CPF (só dígitos)
  company_document?: string; // CNPJ (só dígitos) — remetente PJ
  address: string;
  number: string;
  complement?: string;
  district: string;
  city: string;
  state_abbr: string; // UF
  postal_code: string; // só dígitos
  country_id?: string; // "BR"
};

export type MeProduto = {
  name: string;
  quantity: number;
  unitary_value: number; // R$ por unidade
};

export type MeVolume = {
  height: number; // cm
  width: number;
  length: number;
  weight: number; // kg
};

export type MeOpcoes = {
  insurance_value: number;
  receipt?: boolean;
  own_hand?: boolean;
  reverse?: boolean;
  non_commercial?: boolean;
};

export type InserirCarrinhoInput = {
  service: number; // 4 = Jadlog .Com
  from: MeEndereco;
  to: MeEndereco;
  products: MeProduto[];
  volumes: MeVolume[];
  options: MeOpcoes;
};

// ── Pipeline ─────────────────────────────────────────────────────────────────

/** Insere um frete no carrinho do ME. NÃO gasta saldo. Devolve o id da etiqueta. */
export async function inserirNoCarrinho(
  input: InserirCarrinhoInput,
): Promise<MeResult<{ id: string }>> {
  const r = await meFetch<{ id?: string }>("/api/v2/me/cart", {
    method: "POST",
    body: input,
  });
  if (!r.ok) return r;
  if (!r.data?.id) {
    return { ok: false, status: 502, error: "Melhor Envio não devolveu o id da etiqueta." };
  }
  return { ok: true, data: { id: r.data.id } };
}

/** ⚠️ COMPRA as etiquetas (DEBITA o saldo do ME). Cotar/confirmar ANTES. */
export async function comprarEtiquetas(
  ids: string[],
): Promise<MeResult<unknown>> {
  return meFetch("/api/v2/me/shipment/checkout", {
    method: "POST",
    body: { orders: ids },
  });
}

/** Gera as etiquetas compradas (emite o código de rastreio junto à transportadora). */
export async function gerarEtiquetas(ids: string[]): Promise<MeResult<unknown>> {
  return meFetch("/api/v2/me/shipment/generate", {
    method: "POST",
    body: { orders: ids },
  });
}

/** Devolve a URL do PDF da(s) etiqueta(s). mode "public" = link sem autenticação. */
export async function imprimirEtiquetas(
  ids: string[],
): Promise<MeResult<{ url: string }>> {
  const r = await meFetch<{ url?: string }>("/api/v2/me/shipment/print", {
    method: "POST",
    body: { mode: "public", orders: ids },
  });
  if (!r.ok) return r;
  if (!r.data?.url) {
    return { ok: false, status: 502, error: "Melhor Envio não devolveu o PDF da etiqueta." };
  }
  return { ok: true, data: { url: r.data.url } };
}

// Evento de rastreio normalizado (a partir do array events da resposta do ME).
export type MeEventoRastreio = {
  status: string | null; // status do envio no ME (posted/delivered/…) ou da ocorrência
  descricao: string | null;
  ocorridoEm: string | null; // ISO (data da ocorrência)
};

export type MeRastreio = {
  meShipmentId: string;
  status: string | null; // status geral do envio
  tracking: string | null; // código da transportadora (Jadlog)
  selfTracking: string | null; // código ME…BR (link do Melhor Rastreio)
  eventos: MeEventoRastreio[];
};

type TrackingRespItem = {
  id?: string;
  status?: string;
  tracking?: string;
  self_tracking?: string;
  tracking_events?: { status?: string; description?: string; date?: string }[];
  events?: { status?: string; description?: string; date?: string }[];
};

/**
 * Rastreia um ou mais envios. A resposta do ME é um MAPA {id: {...}}; normaliza
 * pra uma lista de MeRastreio com os eventos ordenados. NÃO gasta saldo (leitura).
 */
export async function rastrearEnvios(
  ids: string[],
): Promise<MeResult<MeRastreio[]>> {
  const r = await meFetch<Record<string, TrackingRespItem>>(
    "/api/v2/me/shipment/tracking",
    { method: "POST", body: { orders: ids } },
  );
  if (!r.ok) return r;

  const out: MeRastreio[] = Object.entries(r.data ?? {}).map(([id, v]) => {
    const brutos = v.tracking_events ?? v.events ?? [];
    const eventos: MeEventoRastreio[] = brutos.map((e) => ({
      status: e.status ?? null,
      descricao: e.description ?? null,
      ocorridoEm: e.date ?? null,
    }));
    return {
      meShipmentId: v.id ?? id,
      status: v.status ?? null,
      tracking: v.tracking ?? null,
      selfTracking: v.self_tracking ?? null,
      eventos,
    };
  });
  return { ok: true, data: out };
}

// Item da listagem de envios (GET /me/orders) — usado p/ reconciliação/depuração.
export type MeEnvioListado = {
  id: string;
  protocol: string | null;
  status: string | null;
  tracking: string | null;
  selfTracking: string | null;
  destinatarioNome: string | null;
  destinatarioEmail: string | null;
  geradoEm: string | null;
  postadoEm: string | null;
};

type OrdersRespItem = {
  id?: string;
  protocol?: string;
  status?: string;
  tracking?: string;
  self_tracking?: string;
  generated_at?: string;
  posted_at?: string;
  to?: { name?: string; email?: string };
};

/** Lista os envios da conta (paginado). Leitura — não gasta saldo. */
export async function listarEnvios(
  page = 1,
): Promise<MeResult<MeEnvioListado[]>> {
  const r = await meFetch<{ data?: OrdersRespItem[] }>(
    `/api/v2/me/orders?page=${page}`,
    { method: "GET" },
  );
  if (!r.ok) return r;
  const envios: MeEnvioListado[] = (r.data?.data ?? []).map((o) => ({
    id: o.id ?? "",
    protocol: o.protocol ?? null,
    status: o.status ?? null,
    tracking: o.tracking ?? null,
    selfTracking: o.self_tracking ?? null,
    destinatarioNome: o.to?.name ?? null,
    destinatarioEmail: o.to?.email ?? null,
    geradoEm: o.generated_at ?? null,
    postadoEm: o.posted_at ?? null,
  }));
  return { ok: true, data: envios };
}

/** URL pública do Melhor Rastreio p/ o cliente (usa o self_tracking, ME…BR). */
export function melhorRastreioUrl(selfTracking: string): string {
  return `https://www.melhorrastreio.com.br/rastreio/${selfTracking}`;
}
