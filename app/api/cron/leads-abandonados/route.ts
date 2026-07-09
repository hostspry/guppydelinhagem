import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processarLeadsAbandonados } from "@/lib/leads-abandono";

// Avisa no Telegram os leads do checkout abandonados (contato preenchido, sem
// pedido em ~15 min). Agendado no Coolify (Scheduled Task) — recomendado a cada
// ~10 min. Protegido por Bearer CRON_SECRET. Runtime Node (Prisma).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[cron-leads] CRON_SECRET não configurado");
    return NextResponse.json({ error: "cron não configurado" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!segredoConfere(token, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const r = await processarLeadsAbandonados();
  return NextResponse.json({ ok: true, ...r });
}

export const GET = handle;
export const POST = handle;
