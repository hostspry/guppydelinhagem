import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/registry";
import { transicionarParaPago } from "@/lib/pedido-baixa";
import { aplicarEstornoPedido } from "@/lib/pagamento-estorno";
import {
  notificarPedidoPago,
  notificarPagamentoRecusado,
} from "@/lib/notificacoes";
import {
  ProviderPagamento,
  StatusPagamento,
  MetodoPagamento,
} from "@/lib/generated/prisma/enums";

// Webhook do PagBank (cartão + Pix + boleto). Runtime Node (Prisma + crypto).
// Mesma robustez do webhook do MP (spec §5):
//  1. Valida AUTENTICIDADE: header x-authenticity-token == SHA256(token + "-" +
//     corpo CRU). Inválido → 401, sem efeito. (Reformatar o corpo quebra o hash.)
//  2. NUNCA confia no corpo p/ decidir status: re-busca o pedido no PagBank
//     (consultarPagamento) e converge a partir daí (fonte da verdade).
//  3. UPSERT: cria a linha Pagamento se ainda não existir (Pix/boleto confirmam
//     assíncrono — pode não haver registro local). Reconciliação por reference_id
//     (= Pedido) e externalId (= charge.id).
//  4. Idempotência: transicionarParaPago (trava estoqueBaixado) baixa UMA vez;
//     aplicarEstornoPedido (trava estornadoEm) estorna UMA vez.
//  5. 200 rápido após persistir (o PagBank reenvia; tudo idempotente).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SHA256(token + "-" + rawBody) em hex deve bater com x-authenticity-token.
function autenticidadeValida(
  rawBody: string,
  header: string | null,
  token: string,
): boolean {
  if (!header) return false;
  const esperado = createHash("sha256")
    .update(`${token}-${rawBody}`)
    .digest("hex");
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(header, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  // Corpo CRU (string) — obrigatório para o hash; reparsear/reformatar o quebra.
  const rawBody = await request.text();

  // ── 1. Autenticidade ──
  const token = process.env.PAGBANK_WEBHOOK_TOKEN;
  if (!token) {
    console.error("[pagbank-webhook] PAGBANK_WEBHOOK_TOKEN não configurado");
    return NextResponse.json({ error: "not configured" }, { status: 401 });
  }
  if (
    !autenticidadeValida(
      rawBody,
      request.headers.get("x-authenticity-token"),
      token,
    )
  ) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Corpo: pedido com id (ORDE_), reference_id e charges[]. Formato legado (XML)
  // ou payloads sem id são reconhecidos com 200 (nada a fazer).
  let body: {
    id?: string;
    reference_id?: string;
    charges?: { id?: string }[];
  } = {};
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true });
  }

  // Re-busca pelo id do pedido (ORDE_) — ou do charge, se vier só ele.
  const consultaId = body.id ?? body.charges?.[0]?.id ?? null;
  if (!consultaId) return NextResponse.json({ received: true });

  // ── 2. Re-buscar no PagBank (fonte da verdade) ──
  let consulta;
  try {
    const provider = getPaymentProvider(ProviderPagamento.PAGBANK);
    consulta = await provider.consultarPagamento(consultaId);
  } catch (e) {
    console.error("[pagbank-webhook] consultar", e);
    return NextResponse.json({ received: true });
  }

  // orderId (Pedido) via reference_id; fallback pela linha Pagamento gravada.
  let orderId = consulta.externalReference ?? body.reference_id ?? null;
  if (!orderId) {
    const pag = await prisma.pagamento.findFirst({
      where: { externalId: consulta.externalId, provider: "PAGBANK" },
      select: { orderId: true },
    });
    orderId = pag?.orderId ?? null;
  }
  if (!orderId) {
    console.error("[pagbank-webhook] pedido não encontrado para", consulta.externalId);
    return NextResponse.json({ received: true });
  }

  // ── 3. Upsert Pagamento + (se aprovado/estornado) convergir, idempotente ──
  let mudouEstoque = false;
  let confirmouPago = false;
  let recusouAgora = false;
  try {
    const res = await prisma.$transaction(async (tx) => {
      // Acha a linha Pagamento PagBank deste pedido: por externalId (charge.id) e,
      // se não achar, a PENDENTE mais recente (Pix/boleto criado sem charge ainda).
      const existente =
        (await tx.pagamento.findFirst({
          where: {
            orderId: orderId as string,
            provider: "PAGBANK",
            externalId: consulta.externalId,
          },
          select: { id: true, status: true },
        })) ??
        (await tx.pagamento.findFirst({
          where: {
            orderId: orderId as string,
            provider: "PAGBANK",
            status: {
              in: [StatusPagamento.PENDENTE, StatusPagamento.EM_ANALISE],
            },
          },
          orderBy: { criadoEm: "desc" },
          select: { id: true, status: true },
        }));
      const statusAnterior = existente?.status ?? null;
      // Transição → recusado: lead quente. Só na TRANSIÇÃO (reenvio não re-notifica).
      if (
        consulta.status === StatusPagamento.RECUSADO &&
        statusAnterior !== StatusPagamento.RECUSADO
      ) {
        recusouAgora = true;
      }

      if (existente) {
        await tx.pagamento.update({
          where: { id: existente.id },
          data: {
            status: consulta.status,
            externalId: consulta.externalId, // grava o charge.id definitivo
            ...(consulta.parcelas ? { parcelas: consulta.parcelas } : {}),
            ...(consulta.bandeira ? { bandeira: consulta.bandeira } : {}),
          },
        });
      } else {
        await tx.pagamento.create({
          data: {
            orderId: orderId as string,
            provider: ProviderPagamento.PAGBANK,
            metodo: consulta.metodo ?? MetodoPagamento.PIX,
            status: consulta.status,
            valor: consulta.valor ?? 0,
            externalId: consulta.externalId,
            parcelas: consulta.parcelas ?? null,
            bandeira: consulta.bandeira ?? null,
          },
        });
      }

      if (consulta.status === StatusPagamento.PAGO) {
        // Transição → PAGO + baixa do pool (trava estoqueBaixado, uma vez só).
        return transicionarParaPago(tx, orderId as string);
      }

      if (consulta.status === StatusPagamento.ESTORNADO) {
        // Estorno feito no PAINEL do PagBank converge aqui (mesma rotina do MP).
        const pag = await tx.pagamento.findFirst({
          where: {
            orderId: orderId as string,
            provider: "PAGBANK",
            externalId: consulta.externalId,
          },
          select: { id: true },
        });
        if (pag) {
          const r = await aplicarEstornoPedido(tx, {
            orderId: orderId as string,
            pagamentoId: pag.id,
            refundId: null,
          });
          return { pago: false, baixou: r.aplicado };
        }
        return { pago: false, baixou: false };
      }

      // EM_ANALISE, PENDENTE (boleto/pix aguardando), RECUSADO: só o Pagamento
      // muda; o pedido segue AGUARDANDO_PAGAMENTO, sem baixa.
      return { pago: false, baixou: false };
    });
    mudouEstoque = res.baixou;
    confirmouPago = res.pago && res.baixou; // 1ª confirmação real
  } catch (e) {
    console.error("[pagbank-webhook] processar", e);
    return NextResponse.json({ received: true });
  }

  if (mudouEstoque) {
    revalidatePath("/admin/produtos");
    revalidatePath("/admin/pedidos");
  }

  // Notificações (fora da transação; helpers nunca lançam).
  if (confirmouPago) {
    await notificarPedidoPago(orderId as string, {
      provider: ProviderPagamento.PAGBANK,
      metodo: consulta.metodo ?? null,
    });
  }
  if (recusouAgora) {
    await notificarPagamentoRecusado(orderId as string);
  }

  // ── 5. 200 rápido ──
  return NextResponse.json({ received: true });
}
