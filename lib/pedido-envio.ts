import "server-only";
import type { Prisma, Transportadora } from "@/lib/generated/prisma/client";

// Marca UM pedido como ENVIADO (status + rastreio + enviadoEm) e cria o
// RastreioEvento inicial + a Notificacao do cliente, tudo na MESMA transação.
// Fonte única usada pela action manual (registrarEnvioManual / lote) e pela
// reconciliação automática do Melhor Envio (lib/rastreio-sync). server-only.
// DEVE rodar dentro de prisma.$transaction (recebe o tx).

export function viaLabel(t: Transportadora | null): string {
  return t === "JADLOG" ? " pela Jadlog" : t === "GOLLOG" ? " pela Gollog" : "";
}

export async function gravarEnvioTx(
  tx: Prisma.TransactionClient,
  o: {
    id: string;
    numero: string;
    clienteId: string;
    userId: string | null;
    transportadora: Transportadora | null;
    codigo: string | null;
  },
): Promise<void> {
  const agora = new Date();
  await tx.order.update({
    where: { id: o.id },
    data: {
      status: "ENVIADO",
      // Só sobrescreve a transportadora quando informada (o lote/poll mantêm a do pedido).
      ...(o.transportadora ? { transportadora: o.transportadora } : {}),
      codigoRastreio: o.codigo,
      enviadoEm: agora,
      rastreioStatus: "posted",
    },
  });
  await tx.rastreioEvento.create({
    data: {
      orderId: o.id,
      status: "posted",
      descricao: "Envio registrado.",
      ocorridoEm: agora,
    },
  });
  await tx.notificacao.create({
    data: {
      orderId: o.id,
      clienteId: o.clienteId,
      userId: o.userId,
      tipo: "ENVIADO",
      titulo: "Pedido enviado",
      corpo: `Seu pedido ${o.numero} foi despachado${viaLabel(o.transportadora)}.${
        o.codigo ? ` Código de rastreio: ${o.codigo}.` : ""
      }`,
    },
  });
}
