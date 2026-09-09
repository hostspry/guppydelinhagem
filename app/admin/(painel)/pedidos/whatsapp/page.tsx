import { PageHeader } from "@/components/admin/PageHeader";
import { VendaWhatsappForm } from "@/components/admin/VendaWhatsappForm";
import { getPedidoFormData } from "@/lib/queries/pedidos";

export const dynamic = "force-dynamic";

export default async function VendaWhatsappPage() {
  const { produtos } = await getPedidoFormData();

  return (
    <div>
      <PageHeader
        title="Venda pelo WhatsApp"
        description="Cole os dados que o cliente mandou e o sistema monta o pedido."
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Pedidos", href: "/admin/pedidos" },
          { label: "WhatsApp" },
        ]}
      />
      <VendaWhatsappForm produtos={produtos} />
    </div>
  );
}
