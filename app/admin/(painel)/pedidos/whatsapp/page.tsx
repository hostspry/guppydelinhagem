import { redirect } from "next/navigation";

// A venda do WhatsApp virou a tela de novo pedido. O endereço fica para os
// links antigos (aviso do Telegram, favoritos) continuarem funcionando.
export default function VendaWhatsappPage() {
  redirect("/admin/pedidos/novo");
}
