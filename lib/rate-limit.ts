// Rate limiting IN-MEMORY (janela fixa por chave/IP).
//
// ⚠️ DÍVIDA CONHECIDA — só funciona com UMA instância (Coolify single-node).
// O estado vive na memória do processo; se o deploy escalar horizontalmente,
// cada instância teria o seu próprio mapa e o limite efetivo seria N× maior
// (e o bloqueio inconsistente entre instâncias). Nesse cenário, MIGRAR para um
// store compartilhado (Redis/Upstash). Enquanto for single-node, é suficiente.

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfter: number };

/**
 * Janela fixa: até `limit` requisições por `windowMs` para a `key`. Retorna
 * `ok:false` + `retryAfter` (segundos) quando estoura.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  // Limpeza oportunista p/ o mapa não crescer indefinidamente (catálogo pequeno;
  // poucas chaves, mas IPs variam). Só varre quando passa de um teto folgado.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now >= b.reset) buckets.delete(k);
  }

  const b = buckets.get(key);
  if (!b || now >= b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, retryAfter: 0 };
}

/**
 * IP do cliente atrás do proxy (Traefik/Coolify). Usa o 1º IP de
 * `x-forwarded-for`; cai para `x-real-ip` e, por fim, "unknown".
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}
