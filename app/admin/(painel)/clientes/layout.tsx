import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

export default async function ClientesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("clientes.ver");
  return <>{children}</>;
}
