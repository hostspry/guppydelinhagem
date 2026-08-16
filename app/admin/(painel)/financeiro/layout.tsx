import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

// Caixa é de administrador e dono; editor não enxerga nem digitando a URL.
export default async function FinanceiroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("financeiro.gerenciar");
  return <>{children}</>;
}
