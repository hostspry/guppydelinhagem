import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sincronizarRastreios } from "@/lib/rastreio-sync";

// Webhook do Melhor Envio: quando o ME empurra uma atualização, dispara a mesma
// sincronização do cron (idempotente). Protegido por um segredo na URL — o ME não
// assina o payload, então o dono configura a URL do webhook como
//   .../api/webhooks/melhorenvio?secret=<CRON_SECRET>
// Sem o segredo correto → 401. O cron periódico é a rede de segurança se o webhook
// não chegar. Runtime Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    // Sem secret configurado, o webhook fica desativado (nunca roda aberto).
    return NextResponse.json({ received: true });
  }
  const recebido = new URL(request.url).searchParams.get("secret") ?? "";
  if (!segredoConfere(recebido, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  // Idempotente: reprocessar não duplica evento (unique de RastreioEvento).
  try {
    await sincronizarRastreios();
  } catch (e) {
    console.error("[me-webhook] sincronizar", e);
  }
  return NextResponse.json({ received: true });
}
