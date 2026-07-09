import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sincronizarRastreios } from "@/lib/rastreio-sync";

// Monitor de rastreio (Melhor Envio): reconcilia envios do painel + poll de status
// + notifica. Agendado no Coolify (Scheduled Task) chamando esta rota. Protegido
// por Bearer CRON_SECRET (mesmo do resumo). Runtime Node (Prisma + fetch ME).
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
    console.error("[cron-rastreio] CRON_SECRET não configurado");
    return NextResponse.json({ error: "cron não configurado" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!segredoConfere(token, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const resumo = await sincronizarRastreios();
  return NextResponse.json({ ok: true, ...resumo });
}

export const GET = handle;
export const POST = handle;
