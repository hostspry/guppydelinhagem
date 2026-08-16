import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

export default async function EquipeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("equipe.gerenciar");
  return <>{children}</>;
}
