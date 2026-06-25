import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/registry";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import { aplicarEstornoPedido } from "@/lib/pagamento-estorno";
import {
  ProviderPagamento,
  StatusPagamento,
  MetodoPagamento,
} from "@/lib/generated/prisma/enums";

// Webhook do Mercado Pago (Pix + Cartão). Runtime Node (Prisma + crypto).
// Fluxo (spec §4 e §6):
//  1. Valida a ASSINATURA (x-signature/x-request-id + HMAC com MP_WEBHOOK_SECRET).
//     Inválida → 401, sem efeito.
//  2. NUNCA confia no corpo: re-busca o pagamento no MP pelo id e usa o status da
//     API + external_reference (= orderId).
//  3. Numa transação IDEMPOTENTE: atualiza a linha Pagamento (status do MP) e,
//     SÓ se aprovado e o pedido ainda não está PAGO, chama transicionarParaPago
//     (baixa com a trava estoqueBaixado). Casos do cartão:
//       - in_process → EM_ANALISE: NÃO mexe no Order/estoque (segue aguardando);
//       - in_process depois vira approved (nova notificação) → transiciona p/ PAGO
//         e baixa UMA vez (a trava barra a segunda baixa, venha do webhook ou da
//         própria action que já confirmou na hora);
//       - rejected/cancelled → só atualiza o Pagamento.
//  4. Responde 200 rápido (o MP reenvia; tudo é idempotente).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Parseia "ts=123,v1=abc" → { ts, v1 }.
function parseSignature(header: string | null): { ts?: string; v1?: string } {
  const out: { ts?: string; v1?: string } = {};
  if (!header) return out;
  for (const parte of header.split(",")) {
    const [k, v] = parte.split("=").map((s) => s.trim());
    if (k === "ts") out.ts = v;
    else if (k === "v1") out.v1 = v;
  }
  return out;
}

// Valida a assinatura conforme a doc do MP. Manifesto:
//   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
// (segmentos ausentes são omitidos; data.id alfanumérico vai em minúsculas).
// HMAC-SHA256(manifesto, secret) em hex deve bater com v1.
function assinaturaValida(args: {
  dataId: string | null;
  requestId: string | null;
  signature: string | null;
  secret: string;
}): boolean {
  const { ts, v1 } = parseSignature(args.signature);
  if (!ts || !v1) return false;

  let manifesto = "";
  if (args.dataId) manifesto += `id:${args.dataId.toLowerCase()};`;
  if (args.requestId) manifesto += `request-id:${args.requestId};`;
  manifesto += `ts:${ts};`;

  const esperado = createHmac("sha256", args.secret)
    .update(manifesto)
    .digest("hex");

  // Comparação em tempo constante (defende contra timing attack).
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(v1, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const url = new URL(request.url);

  // data.id: query (usado no manifesto da assinatura) com fallback pro corpo.
  let body: { type?: string; action?: string; data?: { id?: string | number } } =
    {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const dataId =
    url.searchParams.get("data.id") ??
    url.searchParams.get("id") ??
    (body.data?.id != null ? String(body.data.id) : null);

  const tipo = url.searchParams.get("type") ?? body.type ?? body.action ?? "";

  // ── 1. Assinatura ──
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[mp-webhook] MP_WEBHOOK_SECRET não configurado");
    return NextResponse.json({ error: "not configured" }, { status: 401 });
  }
  const ok = assinaturaValida({
    dataId,
    requestId: request.headers.get("x-request-id"),
    signature: request.headers.get("x-signature"),
    secret,
  });
  if (!ok) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Só tratamos notificações de pagamento; o resto é reconhecido com 200.
  if (!dataId || !tipo.includes("payment")) {
    return NextResponse.json({ received: true });
  }

  // ── 2. Re-buscar o pagamento no MP (fonte da verdade) ──
  let consulta;
  try {
    const provider = getPaymentProvider(ProviderPagamento.MERCADO_PAGO);
    consulta = await provider.consultarPagamento(dataId);
  } catch (e) {
    console.error("[mp-webhook] consultar pagamento", e);
    // 200 mesmo assim: o MP reenvia; um 5xx só geraria retries inúteis se o
    // pagamento ainda não estiver consultável.
    return NextResponse.json({ received: true });
  }

  // orderId vem do external_reference; fallback pela linha Pagamento gravada.
  let orderId = consulta.externalReference;
  if (!orderId) {
    const pag = await prisma.pagamento.findFirst({
      where: { externalId: consulta.externalId },
      select: { orderId: true },
    });
    orderId = pag?.orderId ?? null;
  }
  if (!orderId) {
    console.error("[mp-webhook] pedido não encontrado para", consulta.externalId);
    return NextResponse.json({ received: true });
  }

  // ── 3. Atualizar Pagamento + (se aprovado) confirmar pedido, idempotente ──
  let mudouEstoque = false;
  try {
    const res = await prisma.$transaction(async (tx) => {
      // Atualiza a linha Pagamento deste id — ou CRIA, se não existir. No Checkout
      // Pro o pagamento nasce no MP e pode não ter registro local quando a
      // notificação chega; método/parcelas/bandeira/valor vêm da consulta ao MP.
      const existente = await tx.pagamento.findFirst({
        where: { externalId: consulta.externalId },
        select: { id: true },
      });
      if (existente) {
        await tx.pagamento.update({
          where: { id: existente.id },
          data: { status: consulta.status },
        });
      } else {
        await tx.pagamento.create({
          data: {
            orderId: orderId as string,
            provider: ProviderPagamento.MERCADO_PAGO,
            metodo: consulta.metodo ?? MetodoPagamento.CARTEIRA,
            status: consulta.status,
            valor: consulta.valor ?? 0,
            externalId: consulta.externalId,
            parcelas: consulta.parcelas ?? null,
            bandeira: consulta.bandeira ?? null,
          },
        });
        await tx.order.update({
          where: { id: orderId as string },
          data: {
            mpPaymentId: consulta.externalId,
            ...(consulta.parcelas ? { parcelas: consulta.parcelas } : {}),
          },
        });
      }

      if (consulta.status === StatusPagamento.PAGO) {
        // Função COMPARTILHADA (admin/cartão/webhook): transição → PAGO + baixa
        // do pool, uma vez só (trava estoqueBaixado). Reenvio do MP, ou o cartão
        // que já confirmou na action, não baixam de novo.
        return transicionarParaPago(tx, orderId as string);
      }

      if (consulta.status === StatusPagamento.ESTORNADO) {
        // Estorno feito pelo PAINEL do MP converge aqui: marca estornado, cancela
        // o pedido e devolve o estoque — MESMA rotina idempotente da action do
        // admin (trava estornadoEm). Botão + painel levam ao mesmo estado.
        const pag = await tx.pagamento.findFirst({
          where: { externalId: consulta.externalId },
          select: { id: true },
        });
        if (pag) {
          const r = await aplicarEstornoPedido(tx, {
            orderId: orderId as string,
            pagamentoId: pag.id,
            refundId: null, // o id do refund não vem nesta notificação
          });
          return { pago: false, baixou: r.aplicado };
        }
        return { pago: false, baixou: false };
      }

      // EM_ANALISE (cartão in_process), rejeitado, expirado: só o Pagamento muda;
      // o pedido segue AGUARDANDO_PAGAMENTO, sem baixa.
      return { pago: false, baixou: false };
    });
    mudouEstoque = res.baixou;
  } catch (e) {
    console.error("[mp-webhook] processar", e);
    return NextResponse.json({ received: true });
  }

  if (mudouEstoque) {
    revalidatePath("/admin/produtos");
    revalidatePath("/admin/pedidos");
  }

  // ── 4. 200 rápido ──
  return NextResponse.json({ received: true });
}
