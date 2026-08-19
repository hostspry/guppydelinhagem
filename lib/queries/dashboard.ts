import { prisma } from "../prisma";

export async function getDashboardStats() {
  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  firstDayOfMonth.setHours(0, 0, 0, 0);

  const [
    activeProducts,
    pendingOrders,
    monthRevenue,
    monthOrders,
    customers,
    waitlist,
  ] = await Promise.all([
    prisma.product.count({ where: { ativo: true } }),

    // Contadores de PEDIDO: cobrança avulsa não é venda da loja e tem tela própria.
    prisma.order.count({
      where: { tipo: "PEDIDO", status: { in: ["RASCUNHO", "AGUARDANDO_PAGAMENTO"] } },
    }),

    // Faturamento inclui cobrança avulsa paga — dinheiro que entrou é dinheiro.
    prisma.order.aggregate({
      where: {
        criadoEm: { gte: firstDayOfMonth },
        status: { in: ["PAGO", "ENVIADO", "ENTREGUE"] },
      },
      _sum: { total: true },
    }),

    prisma.order.count({
      where: { tipo: "PEDIDO", criadoEm: { gte: firstDayOfMonth } },
    }),

    prisma.user.count({ where: { role: "CUSTOMER" } }),

    prisma.waitlistEntry.count({ where: { notificado: false } }),
  ]);

  return {
    activeProducts,
    pendingOrders,
    monthRevenue: Number(monthRevenue._sum.total ?? 0),
    monthOrders,
    customers,
    waitlist,
  };
}
