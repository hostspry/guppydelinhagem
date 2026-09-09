import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { credenciais } from "@/lib/shopee/cliente";
import { assinaturaWebhook } from "@/lib/shopee/assinatura";
import { importarPedidoShopee } from "@/lib/shopee/pedidos";

// Aviso da Shopee (push) — pedido novo ou mudança de status.
//
// A Shopee só manda o NÚMERO do pedido, nunca o conteúdo; quem busca os dados
// somos nós. E ela repete o aviso quando não recebe 200 rápido, então tudo aqui
// precisa ser idempotente — quem garante isso é a unique (origem, origemPedidoId).
//
// O endereço precisa ser cadastrado no app da Open Platform, e é ele que entra
// na assinatura. Se o cadastrado e o real divergirem (http vs https, barra no
// fim), toda notificação é recusada aqui como falsa.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Códigos de push que interessam. O resto a Shopee manda e a gente ignora. */
const PUSH_STATUS_PEDIDO = 3;

function confere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request): Promise<Response> {
  // O corpo CRU, antes de virar objeto: a assinatura é sobre os bytes exatos, e
  // um JSON.parse seguido de stringify mudaria espaços e ordem de chaves.
  const corpo = await request.text();

  const c = await credenciais();
  if (!c) {
    // Integração não configurada. 200 de propósito: a Shopee desativa endpoint
    // que responde erro demais, e não queremos perder o push quando ligar.
    return NextResponse.json({ ok: true });
  }

  const url = new URL(request.url);
  const cadastrada = `${url.origin}${url.pathname}`;
  const esperada = assinaturaWebhook(c.partnerKey, cadastrada, corpo);
  const recebida = (request.headers.get("authorization") ?? "").trim();

  if (!confere(recebida, esperada)) {
    console.warn("[shopee-webhook] assinatura não confere");
    return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  }

  let dados: { code?: number; data?: { ordersn?: string; order_sn?: string } };
  try {
    dados = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  if (dados.code !== PUSH_STATUS_PEDIDO) {
    return NextResponse.json({ ok: true, ignorado: dados.code });
  }

  const orderSn = dados.data?.ordersn ?? dados.data?.order_sn ?? "";
  if (!orderSn) return NextResponse.json({ ok: true, ignorado: "sem número" });

  // A importação vai à API da Shopee buscar o pedido, o que leva alguns
  // segundos. Fazemos em linha mesmo: responder 200 antes de gravar faria a
  // Shopee considerar entregue um aviso que ainda pode falhar, e ela não repete
  // o que já deu certo.
  const resumo = await importarPedidoShopee(orderSn);
  if (resumo.erros.length > 0) {
    console.error("[shopee-webhook]", orderSn, resumo.erros);
    // 500 faz a Shopee tentar de novo, que é o que queremos num erro nosso.
    return NextResponse.json({ error: "falha ao importar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...resumo });
}
