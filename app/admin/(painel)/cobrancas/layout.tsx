import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

// Cobrança é dinheiro de venda: mesma guarda dos pedidos. Um EDITOR não vê nem
// digitando a URL.
export default async function CobrancasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("pedidos.ver");
  return <>{children}</>;
}
