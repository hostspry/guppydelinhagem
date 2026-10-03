import { PageHeader } from "@/components/admin/PageHeader";
import { PedidoDistribuidorForm } from "@/components/admin/PedidoDistribuidorForm";
import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

export const dynamic = "force-dynamic";

export default async function PedidoDistribuidorPage() {
  await exigirPermissaoNaPagina("pedidos.editar");
  return (
    <div>
      <PageHeader
        title="Pedido de distribuidor"
        description="O que o revendedor levou e quanto já pagou. O pago entra no caixa; o resto fica a receber."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Pedidos", href: "/admin/pedidos" },
          { label: "Distribuidor" },
        ]}
      />
      <PedidoDistribuidorForm />
    </div>
  );
}
