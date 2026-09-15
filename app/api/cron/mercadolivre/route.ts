import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { renovarToken } from "@/lib/mercadolivre/cliente";
import { importarPedidosMl } from "@/lib/mercadolivre/pedidos";
import { sincronizarEstoqueMl } from "@/lib/mercadolivre/estoque";
import { sincronizarPrazoEnvioMl } from "@/lib/mercadolivre/prazo";

// Rodada do Mercado Livre: renova o token, importa pedidos e empurra o estoque.
// Agendada no Coolify (Scheduled Task), como as outras. Bearer CRON_SECRET.
//
// A cada 15 minutos é o certo aqui, e o motivo é o token: o access_token dura 6
// horas e o refresh_token morre com 6 meses sem uso. Uma rodada frequente mantém
// os dois vivos sozinha — se isto parar por meio ano, o dono autoriza de novo.
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
    console.error("[cron-ml] CRON_SECRET não configurado");
    return NextResponse.json({ error: "cron não configurado" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!segredoConfere(token, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const cfg = await prisma.integracaoMercadoLivre.findUnique({
    where: { id: "default" },
    select: { ativo: true, sellerId: true },
  });
  if (!cfg?.ativo || !cfg.sellerId) {
    return NextResponse.json({ ok: true, pulado: "integração desligada" });
  }

  // Renovar primeiro: com o token velho, tudo o que vem depois falharia junto.
  const renovou = await renovarToken();
  if (!renovou.ok) {
    return NextResponse.json({ ok: false, erro: renovou.erro }, { status: 200 });
  }

  const pedidos = await importarPedidosMl();
  const estoque = await sincronizarEstoqueMl();
  // Peixe sai só na segunda: o prazo no anúncio muda com o dia da semana.
  const prazo = await sincronizarPrazoEnvioMl();

  return NextResponse.json({ ok: true, pedidos, estoque, prazo });
}

export const GET = handle;
export const POST = handle;
