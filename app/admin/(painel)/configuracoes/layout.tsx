import { exigirPermissaoNaPagina } from "@/lib/permissoes-server";

export default async function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirPermissaoNaPagina("config.editar");
  return <>{children}</>;
}
