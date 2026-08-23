import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { campanhasParaDisparar, destinatarios, processarLote } from "@/lib/campanhas";

// Motor das campanhas: dispara as agendadas cuja hora chegou e empurra os lotes
// pendentes das que estão em andamento. Agendado no Coolify (a cada 5 min, por
// exemplo) e protegido por Bearer CRON_SECRET, igual às outras rotinas.
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
    console.error("[cron-campanhas] CRON_SECRET não configurado");
    return NextResponse.json({ error: "cron não configurado" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!segredoConfere(token, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const resultado: { disparadas: string[]; enviados: number; restantes: number } = {
    disparadas: [],
    enviados: 0,
    restantes: 0,
  };

  try {
    // 1) Agendadas cuja hora chegou: congela a lista e marca como enviando.
    for (const id of await campanhasParaDisparar()) {
      const c = await prisma.campanhaEmail.findUnique({ where: { id } });
      if (!c) continue;
      const lista = await destinatarios(c.publico);
      if (lista.length) {
        await prisma.envioCampanha.createMany({
          data: lista.map((d) => ({ campanhaId: id, email: d.email, nome: d.nome })),
          skipDuplicates: true,
        });
      }
      await prisma.campanhaEmail.update({
        where: { id },
        data: {
          status: lista.length ? "ENVIANDO" : "ENVIADA",
          iniciadaEm: new Date(),
          concluidaEm: lista.length ? null : new Date(),
        },
      });
      resultado.disparadas.push(c.nome);
    }

    // 2) Empurra um lote de cada campanha em andamento.
    const emAndamento = await prisma.campanhaEmail.findMany({
      where: { status: "ENVIANDO" },
      select: { id: true },
    });
    for (const c of emAndamento) {
      const r = await processarLote(c.id);
      resultado.enviados += r.enviados;
      resultado.restantes += r.restantes;
    }
  } catch (e) {
    console.error("[cron-campanhas] erro", e);
    return NextResponse.json({ ok: false, error: "falha ao processar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...resultado });
}

export const POST = handle;
export const GET = handle;
