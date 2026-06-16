import { PageHeader } from "@/components/admin/PageHeader";
import { PedidoForm } from "@/components/admin/PedidoForm";
import { getPedidoFormData } from "@/lib/queries/pedidos";

export default async function NovoPedidoPage() {
  const { clientes, produtos } = await getPedidoFormData();

  return (
    <div>
      <PageHeader
        title="Novo pedido"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Pedidos", href: "/admin/pedidos" },
          { label: "Novo" },
        ]}
      />
      <PedidoForm clientes={clientes} produtos={produtos} />
    </div>
  );
}
