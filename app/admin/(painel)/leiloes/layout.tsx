import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

// Cobrança de leilão é dinheiro de venda: mesma guarda dos pedidos e cobranças.
export default async function LeiloesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("pedidos.ver");
  return <>{children}</>;
}
