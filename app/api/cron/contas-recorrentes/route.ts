import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { gerarContasDaCompetencia } from "@/actions/financeiro";
import { competenciaAtual } from "@/lib/financeiro/periodo";

// Gera as contas do mês a partir das recorrências ativas. Agendado no Coolify
// (rodar todo dia 1º basta; rodar todo dia também é seguro, porque a geração é
// idempotente por competência). Mesmo padrão de auth dos outros crons.
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
    console.error("[cron-contas] CRON_SECRET não configurado");
    return NextResponse.json({ error: "cron não configurado" }, { status: 503 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!segredoConfere(token, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const competencia = competenciaAtual();
  try {
    const { criadas } = await gerarContasDaCompetencia(competencia);
    console.log(`[cron-contas] ${competencia}: ${criadas} conta(s) gerada(s)`);
    return NextResponse.json({ ok: true, competencia, criadas });
  } catch (e) {
    console.error("[cron-contas] falhou", e);
    return NextResponse.json({ error: "falha ao gerar contas" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
