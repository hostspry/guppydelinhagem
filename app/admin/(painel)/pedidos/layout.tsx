import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

// Guarda da seção inteira (lista, detalhe, novo). Um EDITOR não vê pedidos nem
// digitando a URL.
export default async function PedidosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("pedidos.ver");
  return <>{children}</>;
}
