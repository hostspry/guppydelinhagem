import "server-only";
import { prisma } from "@/lib/prisma";
import { notificarLeadsAbandonados } from "@/lib/notificacoes";

// Avisa no Telegram os leads do checkout que preencheram contato mas não viraram
// pedido dentro da janela (abandono real). Marca notificadoEm ANTES de enviar
// (não repete). Só leads dos últimos 2 dias (não ressuscita antigos se o cron
// ficou fora do ar). Nunca lança — é chamado pelo cron.

const JANELA_MIN_MS = 15 * 60 * 1000; // espera ~15 min antes de considerar abandono
const JANELA_MAX_MS = 48 * 60 * 60 * 1000;

export async function processarLeadsAbandonados(): Promise<{ notificados: number }> {
  const agora = Date.now();
  const leads = await prisma.leadCheckout.findMany({
    where: {
      convertido: false,
      notificadoEm: null,
      capturadoEm: {
        lte: new Date(agora - JANELA_MIN_MS),
        gte: new Date(agora - JANELA_MAX_MS),
      },
    },
    orderBy: { capturadoEm: "asc" },
    take: 50,
    select: { id: true, nome: true, telefone: true, email: true },
  });
  if (leads.length === 0) return { notificados: 0 };

  // Marca antes de avisar (idempotência contra execução concorrente do cron).
  await prisma.leadCheckout.updateMany({
    where: { id: { in: leads.map((l) => l.id) } },
    data: { notificadoEm: new Date() },
  });
  await notificarLeadsAbandonados(leads);
  return { notificados: leads.length };
}
