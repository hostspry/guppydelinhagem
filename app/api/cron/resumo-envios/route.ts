import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { notificarResumoEnvios } from "@/lib/notificacoes";

// Resumo semanal de quarentena/envios no Telegram. Agendado no Coolify (Scheduled
// Task) — sem scheduler embutido no app. Protegido por Bearer CRON_SECRET; serve
// também para disparo manual (teste / reenviar). Runtime Node (Prisma + crypto).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Comparação em tempo constante (mesmo padrão dos webhooks) — evita timing attack.
function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[cron-resumo] CRON_SECRET não configurado");
    return NextResponse.json({ error: "cron não configurado" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!segredoConfere(token, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  try {
    const { pedidos } = await notificarResumoEnvios();
    return NextResponse.json({ ok: true, pedidos });
  } catch (e) {
    // notificarResumoEnvios não lança, mas blindamos a rota mesmo assim.
    console.error("[cron-resumo] erro inesperado", e);
    return NextResponse.json({ ok: false, error: "erro ao gerar o resumo" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
