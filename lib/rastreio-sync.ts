import "server-only";
import { prisma } from "@/lib/prisma";
import { rastrearEnvios, listarEnvios } from "@/lib/melhorenvio";
import { gravarEnvioTx } from "@/lib/pedido-envio";
import { buildTrackingUrl } from "@/lib/tracking";
import {
  notificarPedidoEnviado,
  notificarPedidoEntregue,
  notificarRastreioAtualizado,
} from "@/lib/notificacoes";

// Sincroniza o rastreio dos pedidos com o Melhor Envio. DUAS partes:
//  - reconciliar: casa envios comprados no PAINEL do ME com pedidos ainda sem
//    meShipmentId (por e-mail do destinatário) e marca ENVIADO (opção 1 do dono);
//  - poll: consulta o status dos envios com meShipmentId, grava ocorrências novas,
//    atualiza o status e marca ENTREGUE automaticamente (avisa no Telegram).
// Read-only no Melhor Envio (não gasta saldo). Idempotente (unique de
// RastreioEvento). Nunca lança — é chamado pelo cron/webhook.

export type SyncResumo = {
  reconciliados: number;
  verificados: number;
  ocorrenciasNovas: number;
  entregues: number;
};

const DELIVERED = "delivered";
// Janela de reconciliação: pedidos recentes ainda não vinculados.
const JANELA_DIAS = 90;
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export async function sincronizarRastreios(): Promise<SyncResumo> {
  const resumo: SyncResumo = {
    reconciliados: 0,
    verificados: 0,
    ocorrenciasNovas: 0,
    entregues: 0,
  };
  try {
    resumo.reconciliados = await reconciliarEnviosDoPainel();
  } catch (e) {
    console.error("[rastreio-sync] reconciliar", e);
  }
  try {
    const p = await pollStatus();
    resumo.verificados = p.verificados;
    resumo.ocorrenciasNovas = p.ocorrenciasNovas;
    resumo.entregues = p.entregues;
  } catch (e) {
    console.error("[rastreio-sync] poll", e);
  }
  return resumo;
}

// ── Reconciliação (opção 1: etiqueta comprada no painel do ME) ─────────────────
async function reconciliarEnviosDoPainel(): Promise<number> {
  const r = await listarEnvios(1);
  if (!r.ok) {
    console.warn("[rastreio-sync] listarEnvios falhou:", r.error);
    return 0;
  }
  // Só envios já efetivados (com id e algum código/postagem).
  const envios = r.data.filter(
    (e) => e.id && (e.selfTracking || e.tracking || e.postadoEm),
  );
  if (envios.length === 0) return 0;

  const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000);
  const candidatos = await prisma.order.findMany({
    where: {
      meShipmentId: null,
      status: { in: ["PAGO", "ENVIADO"] },
      criadoEm: { gte: desde },
    },
    select: {
      id: true,
      numero: true,
      status: true,
      clienteId: true,
      userId: true,
      transportadora: true,
      enderecoEntrega: true,
    },
  });
  if (candidatos.length === 0) return 0;

  const usados = new Set<string>();
  const novosEnviados: string[] = [];
  let n = 0;

  for (const envio of envios) {
    const email = norm(envio.destinatarioEmail);
    if (!email) continue;
    // Casa por e-mail do snapshot; ambíguo (2+) → não adivinha.
    const match = candidatos.filter((c) => {
      if (usados.has(c.id)) return false;
      const e = (c.enderecoEntrega ?? {}) as { email?: string | null };
      return norm(e.email) === email;
    });
    if (match.length !== 1) continue;

    const pedido = match[0];
    usados.add(pedido.id);
    const codigo = envio.tracking ?? envio.selfTracking ?? null;
    try {
      await prisma.$transaction(async (tx) => {
        if (pedido.status === "PAGO") {
          await gravarEnvioTx(tx, {
            id: pedido.id,
            numero: pedido.numero,
            clienteId: pedido.clienteId,
            userId: pedido.userId,
            transportadora: pedido.transportadora,
            codigo,
          });
        }
        // Vincula o envio do ME (dos dois casos: recém-ENVIADO ou já ENVIADO manual).
        await tx.order.update({
          where: { id: pedido.id },
          data: {
            meShipmentId: envio.id,
            selfTracking: envio.selfTracking,
            ...(codigo ? { codigoRastreio: codigo } : {}),
          },
        });
      });
      if (pedido.status === "PAGO") novosEnviados.push(pedido.id);
      n++;
    } catch (e) {
      console.error(`[rastreio-sync] reconciliar pedido ${pedido.numero}`, e);
    }
  }

  // 🚚 uma notificação por pedido recém-descoberto como enviado.
  for (const id of novosEnviados) await notificarPedidoEnviado(id);
  return n;
}

// ── Poll de status (opções 1 e 2: já tem meShipmentId) ────────────────────────
async function pollStatus(): Promise<{
  verificados: number;
  ocorrenciasNovas: number;
  entregues: number;
}> {
  const pedidos = await prisma.order.findMany({
    where: { status: "ENVIADO", meShipmentId: { not: null } },
    select: {
      id: true,
      numero: true,
      meShipmentId: true,
      selfTracking: true,
      codigoRastreio: true,
      cliente: { select: { nome: true } },
    },
  });
  if (pedidos.length === 0) {
    return { verificados: 0, ocorrenciasNovas: 0, entregues: 0 };
  }

  const porShipment = new Map(pedidos.map((p) => [p.meShipmentId as string, p]));
  const ids = [...porShipment.keys()];

  const r = await rastrearEnvios(ids);
  if (!r.ok) {
    console.warn("[rastreio-sync] rastrearEnvios falhou:", r.error);
    return { verificados: 0, ocorrenciasNovas: 0, entregues: 0 };
  }

  const avisos: {
    numero: string;
    cliente: string;
    status: string;
    url: string | null;
  }[] = [];
  let entregues = 0;

  for (const rastreio of r.data) {
    const pedido = porShipment.get(rastreio.meShipmentId);
    if (!pedido) continue;

    // Ocorrências válidas → grava as novas (skipDuplicates na unique).
    const eventos = rastreio.eventos
      .filter((e) => e.status && e.ocorridoEm && !Number.isNaN(Date.parse(e.ocorridoEm)))
      .map((e) => ({
        orderId: pedido.id,
        status: e.status as string,
        descricao: e.descricao,
        ocorridoEm: new Date(e.ocorridoEm as string),
      }));
    let novas = 0;
    if (eventos.length > 0) {
      const res = await prisma.rastreioEvento.createMany({
        data: eventos,
        skipDuplicates: true,
      });
      novas = res.count;
    }

    // Atualiza status/códigos do pedido.
    await prisma.order.update({
      where: { id: pedido.id },
      data: {
        ...(rastreio.status ? { rastreioStatus: rastreio.status } : {}),
        ...(!pedido.selfTracking && rastreio.selfTracking
          ? { selfTracking: rastreio.selfTracking }
          : {}),
        ...(!pedido.codigoRastreio && rastreio.tracking
          ? { codigoRastreio: rastreio.tracking }
          : {}),
      },
    });

    const url = buildTrackingUrl(
      pedido.selfTracking ?? rastreio.selfTracking,
      pedido.codigoRastreio ?? rastreio.tracking,
    );

    // Entregue → transição ENVIADO→ENTREGUE (não mexe em estoque) + ✅.
    if (rastreio.status === DELIVERED) {
      await prisma.order.update({
        where: { id: pedido.id },
        data: { status: "ENTREGUE" },
      });
      await notificarPedidoEntregue(pedido.id);
      entregues++;
    } else if (novas > 0) {
      avisos.push({
        numero: pedido.numero,
        cliente: pedido.cliente.nome,
        status: rastreio.status ?? "atualizado",
        url,
      });
    }
  }

  if (avisos.length > 0) await notificarRastreioAtualizado(avisos);

  return {
    verificados: r.data.length,
    ocorrenciasNovas: avisos.length,
    entregues,
  };
}
