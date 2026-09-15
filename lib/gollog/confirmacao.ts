import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enviarEmail } from "@/lib/email";
import { botao } from "@/lib/emails/layout";
import { montarEmail } from "@/lib/emails/render";
import type { EnderecoEntrega } from "@/lib/validations/pedido";

/**
 * Confirmação do envio aéreo pelo cliente.
 *
 * Na Gollog a caixa não chega em casa: fica na base do aeroporto até alguém ir
 * buscar com documento. Antes de despachar, o cliente confirma pelo link o
 * endereço e o CPF (vão na minuta), o aeroporto e quem retira.
 */

const SITE = "https://www.guppydelinhagem.com.br";

export const linkConfirmacao = (token: string) => `${SITE}/envio-aereo/${token}`;

/** Pedido que vai pelo aéreo e ainda não saiu. */
export function ehEnvioAereoPendente(o: {
  transportadora: string | null;
  modalidadeFrete: string | null;
  tipoEntrega: string;
  status: string;
}): boolean {
  const aereo = o.transportadora === "GOLLOG" || o.modalidadeFrete === "AEREO";
  return (
    aereo &&
    o.tipoEntrega !== "RETIRADA" &&
    !["ENVIADO", "ENTREGUE", "CANCELADO"].includes(o.status)
  );
}

/** Token do link, criado na primeira vez. O número do pedido é sequencial e não serve de segredo. */
export async function garantirTokenConfirmacao(orderId: string): Promise<string | null> {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { confirmacaoEnvioToken: true },
  });
  if (!o) return null;
  if (o.confirmacaoEnvioToken) return o.confirmacaoEnvioToken;
  const token = randomBytes(18).toString("base64url");
  // updateMany com a condição de nulo: duas chamadas juntas não trocam o link
  // que a primeira já mandou.
  await prisma.order.updateMany({
    where: { id: orderId, confirmacaoEnvioToken: null },
    data: { confirmacaoEnvioToken: token },
  });
  const final = await prisma.order.findUnique({
    where: { id: orderId },
    select: { confirmacaoEnvioToken: true },
  });
  return final?.confirmacaoEnvioToken ?? null;
}

export type PedidoConfirmacaoResult =
  | { ok: true; para: string; link: string }
  | { ok: false; motivo: string; link?: string };

/**
 * Manda o e-mail pedindo a confirmação.
 *
 * Automático (`forcar` falso): sai uma vez por pedido, quando ele é pago. Pelo
 * botão do painel (`forcar`): sai de novo, que é o caso do cliente que não viu.
 * Nunca lança: quem chama no fluxo de pagamento não pode cair por causa disso.
 */
export async function pedirConfirmacaoEnvioAereo(
  orderId: string,
  { forcar = false }: { forcar?: boolean } = {},
): Promise<PedidoConfirmacaoResult> {
  try {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        numero: true,
        tipo: true,
        status: true,
        transportadora: true,
        modalidadeFrete: true,
        tipoEntrega: true,
        enderecoEntrega: true,
        confirmacaoEnvioPedidaEm: true,
        confirmacaoEnvioEm: true,
        cliente: { select: { nome: true, email: true } },
      },
    });
    if (!o || o.tipo !== "PEDIDO") return { ok: false, motivo: "Pedido não encontrado." };
    if (!ehEnvioAereoPendente(o)) {
      return { ok: false, motivo: "O pedido não está marcado para envio aéreo ou já saiu." };
    }
    if (!forcar && (o.confirmacaoEnvioPedidaEm || o.confirmacaoEnvioEm)) {
      return { ok: false, motivo: "Confirmação já pedida." };
    }

    const token = await garantirTokenConfirmacao(orderId);
    if (!token) return { ok: false, motivo: "Pedido não encontrado." };
    const link = linkConfirmacao(token);

    const end = (o.enderecoEntrega ?? {}) as Partial<EnderecoEntrega>;
    const email = o.cliente.email ?? end.email ?? null;
    if (!email) {
      return { ok: false, motivo: "O cliente não tem e-mail. Mande o link pelo WhatsApp.", link };
    }

    const nome = (end.nome || o.cliente.nome).trim().split(/\s+/)[0] ?? "";
    const montado = await montarEmail(
      "envio-aereo-confirmar",
      {
        nome,
        numero: o.numero,
        botao_confirmar: botao("Confirmar onde vou retirar", link),
        link,
      },
      `Pedido ${o.numero}: falta confirmar onde você vai retirar.`,
    );
    if (!montado) {
      return {
        ok: false,
        motivo: "O e-mail de confirmação está desligado em Configurações → Mensagens.",
        link,
      };
    }

    const enviado = await enviarEmail({ para: email, assunto: montado.assunto, html: montado.html });
    if (!enviado) {
      return { ok: false, motivo: "Não consegui enviar o e-mail. Mande o link pelo WhatsApp.", link };
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { confirmacaoEnvioPedidaEm: new Date() },
    });
    return { ok: true, para: email, link };
  } catch (e) {
    console.error("[gollog] pedir confirmação", e);
    return { ok: false, motivo: "Não consegui pedir a confirmação agora." };
  }
}
