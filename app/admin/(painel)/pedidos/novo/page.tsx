import { PageHeader } from "@/components/admin/PageHeader";
import { NovoPedidoForm } from "@/components/admin/pedido-novo/NovoPedidoForm";
import { getCatalogoPedido, getCadastrosPeloLink } from "@/lib/queries/pedidos";

export const dynamic = "force-dynamic";

export default async function NovoPedidoPage() {
  const [produtos, cadastros] = await Promise.all([
    getCatalogoPedido(),
    getCadastrosPeloLink(),
  ]);

  return (
    <div>
      <PageHeader
        title="Novo pedido"
        description="Cole a conversa do WhatsApp ou mande os prints. Eu monto o pedido para você conferir."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Pedidos", href: "/admin/pedidos" },
          { label: "Novo" },
        ]}
      />
      <NovoPedidoForm produtos={produtos} cadastros={cadastros} />
    </div>
  );
}
