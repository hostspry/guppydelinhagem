import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enviarTelegram } from "@/lib/telegram";

/**
 * Aviso de retenção do histórico de visitantes.
 *
 * O dono escolheu NÃO apagar nada automaticamente, mas quis ser avisado quando
 * houver dado com mais de 90 dias — é o lembrete para decidir se limpa. Roda no
 * agendador do Coolify (semanal ou mensal já basta) e só fala quando há algo a
 * dizer, para o aviso não virar ruído ignorável.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIAS = 90;

function segredoConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "cron não configurado" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!segredoConfere(token, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const corte = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);

  const [eventos, maisAntigo] = await Promise.all([
    prisma.eventoVisitante.count({ where: { ocorridoEm: { lt: corte } } }),
    prisma.eventoVisitante.findFirst({
      orderBy: { ocorridoEm: "asc" },
      select: { ocorridoEm: true },
    }),
  ]);

  if (eventos === 0) {
    return NextResponse.json({ ok: true, eventos: 0, avisou: false });
  }

  const desde = maisAntigo
    ? maisAntigo.ocorridoEm.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "?";

  await enviarTelegram(
    [
      "🗂️ <b>Histórico de visitantes</b>",
      "",
      `Existem <b>${eventos}</b> registros com mais de ${DIAS} dias (o mais antigo é de ${desde}).`,
      "",
      "Nada é apagado sozinho. Se não precisar mais deles:",
      "https://guppydelinhagem.com.br/admin/visitantes",
    ].join("\n"),
  );

  return NextResponse.json({ ok: true, eventos, avisou: true });
}

export const GET = handle;
export const POST = handle;
