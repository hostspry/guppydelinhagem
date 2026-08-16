import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/queries/dashboard";
import { StatCard } from "@/components/admin/StatCard";
import {
  Bell,
  Clock,
  DollarSign,
  Image as ImageIcon,
  Package,
  Plus,
  ShoppingBag,
  Users,
} from "lucide-react";
import Link from "next/link";

const currencyBR = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ semPermissao?: string }>;
}) {
  const session = await auth();
  const stats = await getDashboardStats();
  const { semPermissao } = await searchParams;

  return (
    <div>
      <h1 className="text-xl md:text-2xl font-semibold text-[#07366A] mb-1">
        Bem-vindo, {session?.user.name?.split(" ")[0] ?? "Admin"}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Visão geral do seu e-commerce de guppies premium.
      </p>

      {/* Alguém tentou abrir uma área fora do seu perfil (link antigo ou URL na mão). */}
      {semPermissao && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Essa área não faz parte do seu perfil de acesso. Se você precisa dela,
          peça ao dono da loja para ajustar sua permissão.
        </div>
      )}

      {/* Grid de stats: 2 cols mobile, 3 cols desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard
          icon={Package}
          label="Produtos ativos"
          value={stats.activeProducts}
          description="Em todas as categorias"
        />
        <StatCard
          icon={Clock}
          label="Pedidos pendentes"
          value={stats.pendingOrders}
          description="Aguardando ação"
        />
        <StatCard
          icon={DollarSign}
          label="Receita do mês"
          value={currencyBR.format(stats.monthRevenue)}
          description={`${stats.monthOrders} vendas`}
        />
        <StatCard
          icon={ShoppingBag}
          label="Pedidos do mês"
          value={stats.monthOrders}
          description="Confirmados ou em andamento"
        />
        <StatCard
          icon={Users}
          label="Clientes"
          value={stats.customers}
          description="Cadastrados no site"
        />
        <StatCard
          icon={Bell}
          label="Lista de espera"
          value={stats.waitlist}
          description="Aguardando avisos"
        />
      </div>

      {/* Ações rápidas */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-5">
        <h2 className="text-sm font-medium text-[#07366A] mb-3">
          Ações rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <QuickAction
            href="/admin/produtos/novo"
            icon={Plus}
            title="Novo produto"
            subtitle="Adicionar guppy ao catálogo"
          />
          <QuickAction
            href="/admin/pedidos"
            icon={Clock}
            title="Pedidos pendentes"
            subtitle={`${stats.pendingOrders} aguardando`}
          />
          <QuickAction
            href="/admin/hero-slides"
            icon={ImageIcon}
            title="Editar hero"
            subtitle="Slides da home"
          />
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: typeof Plus;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:border-[#FF035C] transition-colors"
    >
      <div className="w-8 h-8 rounded-md bg-[#FF035C]/10 text-[#FF035C] flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>
      <div className="leading-tight min-w-0">
        <div className="text-xs font-medium text-[#07366A]">{title}</div>
        <div className="text-[10px] text-gray-500">{subtitle}</div>
      </div>
    </Link>
  );
}
