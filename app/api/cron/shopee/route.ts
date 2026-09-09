import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { renovarToken } from "@/lib/shopee/cliente";
import { importarPedidosShopee } from "@/lib/shopee/pedidos";
import { sincronizarEstoqueShopee } from "@/lib/shopee/estoque";

// Rodada da Shopee: renova o token, importa pedidos e empurra o estoque.
// Agendada no Coolify (Scheduled Task), como as outras. Protegida por Bearer
// CRON_SECRET. Runtime Node (Prisma + crypto).
//
// A cada 15 minutos é o certo aqui, e o motivo é o token: o access_token dura
// 4 horas e o refresh_token morre com 30 dias SEM USO. Uma rodada frequente
// mantém os dois vivos sozinha — se isto parar por um mês, o dono tem que
// autorizar a loja de novo na mão.
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
    console.error("[cron-shopee] CRON_SECRET não configurado");
    return NextResponse.json({ error: "cron não configurado" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!segredoConfere(token, secret)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const cfg = await prisma.integracaoShopee.findUnique({
    where: { id: "default" },
    select: { ativo: true, shopId: true },
  });
  if (!cfg?.ativo || !cfg.shopId) {
    return NextResponse.json({ ok: true, pulado: "integração desligada" });
  }

  // Renovar primeiro: com o token velho, tudo o que vem depois falharia junto.
  const renovou = await renovarToken();
  if (!renovou.ok) {
    return NextResponse.json({ ok: false, erro: renovou.erro }, { status: 200 });
  }

  const pedidos = await importarPedidosShopee();
  const estoque = await sincronizarEstoqueShopee();

  return NextResponse.json({ ok: true, pedidos, estoque });
}

export const GET = handle;
export const POST = handle;
