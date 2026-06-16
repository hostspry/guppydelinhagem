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

    prisma.order.count({
      where: { status: { in: ["RASCUNHO", "AGUARDANDO_PAGAMENTO"] } },
    }),

    prisma.order.aggregate({
      where: {
        criadoEm: { gte: firstDayOfMonth },
        status: { in: ["PAGO", "ENVIADO", "ENTREGUE"] },
      },
      _sum: { total: true },
    }),

    prisma.order.count({ where: { criadoEm: { gte: firstDayOfMonth } } }),

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
