import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

export default async function SorteiosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("sorteios.gerenciar");
  return <>{children}</>;
}
